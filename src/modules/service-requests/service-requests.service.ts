import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceRequestStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuthPrincipal } from '../auth/auth.types';
import { ProviderMatchingService } from '../provider-matching/provider-matching.service';
import { CreateEnquiryDto, CreateServiceRequestDto, UpdateServiceRequestDto } from './service-requests.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly matching: ProviderMatchingService) {}

  private async customer(principal: AuthPrincipal) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId: principal.id } });
    if (!customer) throw new ForbiddenException('Customer profile is required.');
    return customer;
  }

  private async ownedRequest(principal: AuthPrincipal, id: string) {
    const customer = await this.customer(principal);
    const request = await this.prisma.serviceRequest.findFirst({ where: { id, customerId: customer.id } });
    if (!request) throw new NotFoundException('Service request not found.');
    return { customer, request };
  }

  async create(principal: AuthPrincipal, input: CreateServiceRequestDto) {
    const customer = await this.customer(principal);
    if (input.addressId) {
      const address = await this.prisma.customerAddress.findFirst({ where: { id: input.addressId, customerId: customer.id } });
      if (!address) throw new BadRequestException('Address is invalid.');
    }
    if (input.locationId) {
      const location = await this.prisma.location.findFirst({ where: { id: input.locationId, isActive: true } });
      if (!location) throw new BadRequestException('Location is invalid.');
    }
    const categoryIds = [...new Set(input.categoryIds ?? [])];
    const serviceIds = [...new Set(input.serviceIds ?? [])];
    if (categoryIds.length) {
      const categories = await this.prisma.category.count({ where: { id: { in: categoryIds }, isActive: true, deletedAt: null } });
      if (categories !== categoryIds.length) throw new BadRequestException('One or more categories are invalid.');
    }
    if (serviceIds.length) {
      const services = await this.prisma.service.findMany({ where: { id: { in: serviceIds }, isActive: true, deletedAt: null }, select: { id: true, categoryId: true } });
      if (services.length !== serviceIds.length) throw new BadRequestException('One or more services are invalid.');
      if (categoryIds.length) {
        if (!services.every((service) => categoryIds.includes(service.categoryId))) throw new BadRequestException('A selected service does not belong to the selected categories.');
      }
    }
    if (input.attachmentMediaIds?.length) {
      const media = await this.prisma.mediaFile.findMany({ where: { id: { in: [...new Set(input.attachmentMediaIds)] }, ownerUserId: principal.id } });
      if (media.length !== new Set(input.attachmentMediaIds).size) throw new BadRequestException('One or more attachments are invalid or not owned by the customer.');
    }
    if (input.budgetMin && input.budgetMax && new Prisma.Decimal(input.budgetMin).gt(new Prisma.Decimal(input.budgetMax))) throw new BadRequestException('Minimum budget cannot exceed maximum budget.');

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.create({ data: {
        customerId: customer.id,
        addressId: input.addressId,
        locationId: input.locationId,
        title: input.title,
        description: input.description,
        preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
        urgency: input.urgency ?? 'NORMAL',
        budgetMin: input.budgetMin ? new Prisma.Decimal(input.budgetMin) : null,
        budgetMax: input.budgetMax ? new Prisma.Decimal(input.budgetMax) : null,
        currency: input.currency ?? 'LKR',
        status: ServiceRequestStatus.DRAFT,
      } });
      if (categoryIds.length) await tx.serviceRequestCategory.createMany({ data: categoryIds.map((categoryId, index) => ({ serviceRequestId: request.id, categoryId, isPrimary: index === 0 })) });
      if (serviceIds.length) await tx.serviceRequestService.createMany({ data: serviceIds.map((serviceId, index) => ({ serviceRequestId: request.id, serviceId, isPrimary: index === 0 })) });
      if (input.attachmentMediaIds?.length) await tx.serviceRequestAttachment.createMany({ data: [...new Set(input.attachmentMediaIds)].map((mediaFileId) => ({ serviceRequestId: request.id, mediaFileId })) });
      return tx.serviceRequest.findUnique({ where: { id: request.id }, include: { categories: true, services: true, attachments: { include: { mediaFile: true } } } });
    });
  }

  async list(principal: AuthPrincipal) {
    const customer = await this.customer(principal);
    return this.prisma.serviceRequest.findMany({ where: { customerId: customer.id }, include: { categories: true, services: true, recipients: true, enquiries: true }, orderBy: { createdAt: 'desc' } });
  }

  async detail(principal: AuthPrincipal, id: string) {
    const { customer } = await this.ownedRequest(principal, id);
    return this.prisma.serviceRequest.findFirst({ where: { id, customerId: customer.id }, include: { categories: { include: { category: true } }, services: { include: { service: true } }, attachments: { include: { mediaFile: true } }, recipients: { include: { providerProfile: { select: { id: true, displayName: true, providerType: true, verificationStatus: true } } } }, enquiries: true } });
  }

  async update(principal: AuthPrincipal, id: string, input: UpdateServiceRequestDto) {
    const { request } = await this.ownedRequest(principal, id);
    if (request.status !== ServiceRequestStatus.DRAFT) throw new BadRequestException('Only draft requests can be updated.');
    return this.prisma.serviceRequest.update({ where: { id }, data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
      ...(input.addressId !== undefined ? { addressId: input.addressId } : {}),
      ...(input.preferredDate !== undefined ? { preferredDate: input.preferredDate ? new Date(input.preferredDate) : null } : {}),
      ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
    } });
  }

  async cancel(principal: AuthPrincipal, id: string) {
    const { request } = await this.ownedRequest(principal, id);
    if (!['DRAFT', 'OPEN'].includes(request.status)) throw new BadRequestException('This request cannot be cancelled.');
    return this.prisma.serviceRequest.update({ where: { id }, data: { status: ServiceRequestStatus.CANCELLED } });
  }

  async submit(principal: AuthPrincipal, id: string) {
    const { request } = await this.ownedRequest(principal, id);
    if (request.status !== ServiceRequestStatus.DRAFT) throw new BadRequestException('Only draft requests can be submitted.');
    const categories = await this.prisma.serviceRequestCategory.findMany({ where: { serviceRequestId: id }, select: { categoryId: true } });
    const services = await this.prisma.serviceRequestService.findMany({ where: { serviceRequestId: id }, select: { serviceId: true } });
    return this.matching.distribute({
      id,
      locationId: request.locationId,
      categoryIds: categories.map((item) => item.categoryId),
      serviceIds: services.map((item) => item.serviceId),
    });
  }

  async createEnquiry(principal: AuthPrincipal, input: CreateEnquiryDto) {
    if (!principal.providerProfile) throw new ForbiddenException('Provider profile is required.');
    if (input.serviceRequestId) {
      const recipient = await this.prisma.serviceRequestRecipient.findUnique({ where: { serviceRequestId_providerProfileId: { serviceRequestId: input.serviceRequestId, providerProfileId: principal.providerProfile.id } } });
      if (!recipient) throw new ForbiddenException('The request was not distributed to this provider.');
      const request = await this.prisma.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request) throw new NotFoundException('Service request not found.');
      await this.prisma.serviceRequestRecipient.update({ where: { id: recipient.id }, data: { responseStatus: 'RESPONDED', respondedAt: new Date() } });
      return this.prisma.enquiry.create({ data: { customerId: request.customerId, providerProfileId: principal.providerProfile.id, serviceRequestId: request.id, subject: input.subject, message: input.message } });
    }
    throw new BadRequestException('An assigned service request is required for a provider enquiry.');
  }

  async providerAssigned(principal: AuthPrincipal) {
    if (!principal.providerProfile) throw new ForbiddenException('Provider profile is required.');
    return this.prisma.serviceRequestRecipient.findMany({ where: { providerProfileId: principal.providerProfile.id }, include: { serviceRequest: { include: { categories: true, services: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async providerAssignedDetail(principal: AuthPrincipal, requestId: string) {
    if (!principal.providerProfile) throw new ForbiddenException('Provider profile is required.');
    const recipient = await this.prisma.serviceRequestRecipient.findUnique({
      where: {
        serviceRequestId_providerProfileId: {
          serviceRequestId: requestId,
          providerProfileId: principal.providerProfile.id,
        },
      },
      include: {
        serviceRequest: {
          include: {
            categories: true,
            services: true,
            attachments: true,
          },
        },
      },
    });
    if (!recipient) throw new ForbiddenException('The request was not distributed to this provider.');
    if (recipient.responseStatus === 'PENDING') await this.prisma.serviceRequestRecipient.update({ where: { id: recipient.id }, data: { responseStatus: 'VIEWED' } });
    return recipient.serviceRequest;
  }

  async providerEnquiries(principal: AuthPrincipal) {
    if (!principal.providerProfile) throw new ForbiddenException('Provider profile is required.');
    return this.prisma.enquiry.findMany({ where: { providerProfileId: principal.providerProfile.id }, orderBy: { createdAt: 'desc' } });
  }

  async customerEnquiries(principal: AuthPrincipal) {
    const customer = await this.customer(principal);
    return this.prisma.enquiry.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } });
  }
}

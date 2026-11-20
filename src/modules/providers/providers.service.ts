import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationType, Prisma, ProviderType, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuthPrincipal } from '../auth/auth.types';
import { ProviderAvailabilityDto, ProviderCategoryDto, ProviderCoverageDto, ProviderSearchDto, ProviderServiceDto, UpdateBusinessDetailsDto, UpdateProviderProfileDto } from './providers.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private async own(principal: AuthPrincipal) {
    if (!principal.providerProfile) throw new ForbiddenException('Provider profile is required.');
    return principal.providerProfile.id;
  }

  async me(principal: AuthPrincipal) {
    const id = await this.own(principal);
    return this.prisma.providerProfile.findUnique({
      where: { id },
      include: { businessDetails: true, verifications: true, documents: { include: { mediaFile: true } }, portfolio: { include: { media: { include: { mediaFile: true } } } }, categories: { include: { category: true } }, providerServices: { include: { service: { include: { category: true } } } }, serviceAreas: { include: { location: { include: { parent: true } } } }, availability: true },
    });
  }

  async updateProfile(principal: AuthPrincipal, input: UpdateProviderProfileDto) {
    const id = await this.own(principal);
    if (input.profileImageMediaId) {
      const media = await this.prisma.mediaFile.findFirst({ where: { id: input.profileImageMediaId, ownerUserId: principal.id } });
      if (!media) throw new BadRequestException('Profile image is not owned by the authenticated user.');
    }
    return this.prisma.providerProfile.update({ where: { id }, data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.experienceYears !== undefined ? { experienceYears: input.experienceYears } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...(input.profileImageMediaId !== undefined ? { profileImageId: input.profileImageMediaId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } });
  }

  async updateBusiness(principal: AuthPrincipal, input: UpdateBusinessDetailsDto) {
    const id = await this.own(principal);
    const profile = await this.prisma.providerProfile.findUnique({ where: { id } });
    if (!profile || profile.providerType !== ProviderType.BUSINESS) throw new BadRequestException('Business provider details are unavailable.');
    return this.prisma.providerBusinessDetails.upsert({
      where: { providerProfileId: id },
      create: { providerProfileId: id, ...input },
      update: input,
    });
  }

  async completion(principal: AuthPrincipal) {
    const id = await this.own(principal);
    const profile = await this.prisma.providerProfile.findUnique({ where: { id }, include: { businessDetails: true, providerServices: true, serviceAreas: true, documents: true } });
    if (!profile) throw new NotFoundException('Provider profile not found.');
    const checks = [
      Boolean(profile.displayName),
      Boolean(profile.description),
      Boolean(profile.contactEmail || profile.contactPhone),
      profile.providerServices.length > 0,
      profile.serviceAreas.length > 0,
      profile.providerType !== ProviderType.BUSINESS || Boolean(profile.businessDetails),
    ];
    const completion = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    await this.prisma.providerProfile.update({ where: { id }, data: { profileCompletion: completion } });
    return { completion, verificationStatus: profile.verificationStatus, checks: { displayName: checks[0], description: checks[1], contact: checks[2], services: checks[3], coverage: checks[4], businessDetails: checks[5] } };
  }

  async categories(principal: AuthPrincipal) {
    const id = await this.own(principal);
    return this.prisma.providerCategory.findMany({ where: { providerProfileId: id }, include: { category: true }, orderBy: { createdAt: 'asc' } });
  }

  async addCategory(principal: AuthPrincipal, input: ProviderCategoryDto) {
    const id = await this.own(principal);
    const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, isActive: true, deletedAt: null } });
    if (!category) throw new BadRequestException('Category is invalid.');
    return this.prisma.providerCategory.create({ data: { providerProfileId: id, categoryId: category.id } });
  }

  async removeCategory(principal: AuthPrincipal, categoryId: string) {
    const id = await this.own(principal);
    const assigned = await this.prisma.providerCategory.findUnique({ where: { providerProfileId_categoryId: { providerProfileId: id, categoryId } } });
    if (!assigned) throw new NotFoundException('Category assignment not found.');
    await this.prisma.providerCategory.delete({ where: { id: assigned.id } });
  }

  async services(principal: AuthPrincipal) {
    const id = await this.own(principal);
    return this.prisma.providerService.findMany({ where: { providerProfileId: id }, include: { service: { include: { category: true } } }, orderBy: { createdAt: 'asc' } });
  }

  async addService(principal: AuthPrincipal, input: ProviderServiceDto) {
    const id = await this.own(principal);
    const service = await this.prisma.service.findFirst({ where: { id: input.serviceId, isActive: true, deletedAt: null }, include: { category: true } });
    if (!service) throw new BadRequestException('Service is invalid.');
    const category = await this.prisma.providerCategory.findUnique({ where: { providerProfileId_categoryId: { providerProfileId: id, categoryId: service.categoryId } } });
    if (!category) throw new BadRequestException('Add the service category before assigning this service.');
    if (input.priceFrom && input.priceTo && new Prisma.Decimal(input.priceFrom).gt(new Prisma.Decimal(input.priceTo))) throw new BadRequestException('Minimum price cannot exceed maximum price.');
    return this.prisma.providerService.create({ data: { providerProfileId: id, serviceId: service.id, description: input.description, priceFrom: input.priceFrom ? new Prisma.Decimal(input.priceFrom) : null, priceTo: input.priceTo ? new Prisma.Decimal(input.priceTo) : null, currency: input.currency ?? 'LKR', isActive: input.isActive ?? true } });
  }

  async updateService(principal: AuthPrincipal, serviceId: string, input: ProviderServiceDto) {
    const id = await this.own(principal);
    const assigned = await this.prisma.providerService.findUnique({ where: { providerProfileId_serviceId: { providerProfileId: id, serviceId } } });
    if (!assigned) throw new NotFoundException('Service assignment not found.');
    const priceFrom = input.priceFrom !== undefined ? input.priceFrom : assigned.priceFrom?.toString();
    const priceTo = input.priceTo !== undefined ? input.priceTo : assigned.priceTo?.toString();
    if (priceFrom && priceTo && new Prisma.Decimal(priceFrom).gt(new Prisma.Decimal(priceTo))) throw new BadRequestException('Minimum price cannot exceed maximum price.');
    return this.prisma.providerService.update({ where: { id: assigned.id }, data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priceFrom !== undefined ? { priceFrom: input.priceFrom ? new Prisma.Decimal(input.priceFrom) : null } : {}),
      ...(input.priceTo !== undefined ? { priceTo: input.priceTo ? new Prisma.Decimal(input.priceTo) : null } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } });
  }

  async removeService(principal: AuthPrincipal, serviceId: string) {
    const id = await this.own(principal);
    const assigned = await this.prisma.providerService.findUnique({ where: { providerProfileId_serviceId: { providerProfileId: id, serviceId } } });
    if (!assigned) throw new NotFoundException('Service assignment not found.');
    await this.prisma.providerService.delete({ where: { id: assigned.id } });
  }

  async coverage(principal: AuthPrincipal) {
    const id = await this.own(principal);
    return this.prisma.providerServiceArea.findMany({ where: { providerProfileId: id }, include: { location: { include: { parent: { include: { parent: true } } } } } });
  }

  async addCoverage(principal: AuthPrincipal, input: ProviderCoverageDto) {
    const id = await this.own(principal);
    const location = await this.prisma.location.findFirst({ where: { id: input.locationId, isActive: true, type: { in: [LocationType.DISTRICT, LocationType.CITY, LocationType.TOWN] } } });
    if (!location) throw new BadRequestException('Coverage location must be an active district, city, or town.');
    return this.prisma.providerServiceArea.create({ data: { providerProfileId: id, locationId: location.id } });
  }

  async removeCoverage(principal: AuthPrincipal, locationId: string) {
    const id = await this.own(principal);
    const assigned = await this.prisma.providerServiceArea.findUnique({ where: { providerProfileId_locationId: { providerProfileId: id, locationId } } });
    if (!assigned) throw new NotFoundException('Coverage area not found.');
    await this.prisma.providerServiceArea.delete({ where: { id: assigned.id } });
  }

  private time(value: string): Date {
    const [hours, minutes] = value.split(':').map(Number);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  }

  async availability(principal: AuthPrincipal) {
    const id = await this.own(principal);
    return this.prisma.providerAvailability.findMany({ where: { providerProfileId: id }, orderBy: { dayOfWeek: 'asc' } });
  }

  async updateAvailability(principal: AuthPrincipal, input: ProviderAvailabilityDto) {
    const id = await this.own(principal);
    const start = this.time(input.startTime);
    const end = this.time(input.endTime);
    if (start >= end) throw new BadRequestException('Start time must be before end time.');
    return this.prisma.providerAvailability.upsert({
      where: { providerProfileId_dayOfWeek: { providerProfileId: id, dayOfWeek: input.dayOfWeek } },
      create: { providerProfileId: id, dayOfWeek: input.dayOfWeek, startTime: start, endTime: end, timeZone: input.timeZone ?? 'Asia/Colombo', isAvailable: input.isAvailable ?? true },
      update: { startTime: start, endTime: end, timeZone: input.timeZone ?? 'Asia/Colombo', isAvailable: input.isAvailable ?? true },
    });
  }

  async removeAvailability(principal: AuthPrincipal, dayOfWeek: number) {
    const id = await this.own(principal);
    const schedule = await this.prisma.providerAvailability.findUnique({ where: { providerProfileId_dayOfWeek: { providerProfileId: id, dayOfWeek } } });
    if (!schedule) throw new NotFoundException('Availability schedule not found.');
    await this.prisma.providerAvailability.delete({ where: { id: schedule.id } });
  }

  async search(query: ProviderSearchDto) {
    const coverageLocationIds = new Set<string>();
    if (query.locationId) coverageLocationIds.add(query.locationId);
    if (query.districtId) {
      coverageLocationIds.add(query.districtId);
      const children = await this.prisma.location.findMany({ where: { parentId: query.districtId, isActive: true }, select: { id: true } });
      children.forEach((item) => coverageLocationIds.add(item.id));
    }
    if (query.provinceId) {
      const districts = await this.prisma.location.findMany({ where: { parentId: query.provinceId, type: LocationType.DISTRICT, isActive: true }, select: { id: true } });
      districts.forEach((item) => coverageLocationIds.add(item.id));
    }
    const where: Prisma.ProviderProfileWhereInput = {
      isActive: true,
      deletedAt: null,
      verificationStatus: VerificationStatus.APPROVED,
      ...(query.providerType ? { providerType: query.providerType as ProviderType } : {}),
      ...(query.minRating ? { averageRating: { gte: new Prisma.Decimal(query.minRating) } } : {}),
      ...(query.keyword ? { OR: [{ displayName: { contains: query.keyword, mode: 'insensitive' } }, { description: { contains: query.keyword, mode: 'insensitive' } }] } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.serviceId ? { providerServices: { some: { serviceId: query.serviceId, isActive: true } } } : {}),
      ...(coverageLocationIds.size ? { serviceAreas: { some: { locationId: { in: [...coverageLocationIds] } } } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerProfile.findMany({
        where,
        select: { id: true, providerType: true, displayName: true, description: true, experienceYears: true, profileImageId: true, contactEmail: true, contactPhone: true, verificationStatus: true, averageRating: true, totalReviews: true, profileCompletion: true, providerServices: { where: { isActive: true }, include: { service: { select: { id: true, name: true, slug: true } } } }, serviceAreas: { include: { location: { select: { id: true, type: true, name: true, slug: true } } } } },
        orderBy: query.sort === 'rating' ? [{ averageRating: 'desc' }, { totalReviews: 'desc' }] : query.sort === 'newest' ? { createdAt: 'desc' } : [{ averageRating: 'desc' }, { displayName: 'asc' }],
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.providerProfile.count({ where }),
    ]);
    return { items, pagination: { page: query.page ?? 1, limit: query.limit ?? 20, total, totalPages: Math.ceil(total / (query.limit ?? 20)) } };
  }

  async publicDetail(idOrSlug: string) {
    const profile = await this.prisma.providerProfile.findFirst({
      where: { isActive: true, deletedAt: null, verificationStatus: VerificationStatus.APPROVED, OR: [{ id: idOrSlug }, { displayName: { equals: idOrSlug } }] },
      select: { id: true, providerType: true, displayName: true, description: true, experienceYears: true, profileImageId: true, verificationStatus: true, averageRating: true, totalReviews: true, profileCompletion: true, businessDetails: true, providerServices: { where: { isActive: true }, include: { service: { select: { id: true, name: true, slug: true, category: { select: { id: true, name: true, slug: true } } } } } }, serviceAreas: { include: { location: { select: { id: true, type: true, name: true, slug: true } } } }, portfolio: { include: { media: { include: { mediaFile: { select: { id: true, objectKey: true, mimeType: true } } } } } } },
    });
    if (!profile) throw new NotFoundException('Provider not found.');
    return profile;
  }

  async providersForService(serviceId: string) {
    return this.search({ serviceId, page: 1, limit: 100 });
  }

  async providersAtLocation(locationId: string) {
    return this.search({ locationId, page: 1, limit: 100 });
  }

  async adminReview(id: string) {
    return this.prisma.providerProfile.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, status: true } }, verifications: true, documents: { include: { mediaFile: true } }, businessDetails: true } });
  }
}

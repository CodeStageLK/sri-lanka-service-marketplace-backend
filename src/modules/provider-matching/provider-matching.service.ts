import { Injectable } from '@nestjs/common';
import { DeliveryStatus, Prisma, ProviderResponseStatus, UserStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface MatchingRequest {
  id: string;
  locationId: string | null;
  categoryIds: string[];
  serviceIds: string[];
}

@Injectable()
export class ProviderMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async isEligible(providerProfileId: string, request: MatchingRequest): Promise<{ eligible: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: { user: true, categories: true, providerServices: true, serviceAreas: true },
    });
    if (!provider) return { eligible: false, reasons: ['provider_not_found'] };
    if (provider.user.status !== UserStatus.ACTIVE || provider.user.deletedAt) reasons.push('account_ineligible');
    if (!provider.isActive || provider.deletedAt) reasons.push('profile_ineligible');
    if (provider.verificationStatus !== VerificationStatus.APPROVED) reasons.push('verification_not_approved');

    if (request.categoryIds.length) {
      const assigned = new Set(provider.categories.map((item) => item.categoryId));
      if (!request.categoryIds.every((id) => assigned.has(id))) reasons.push('category_not_supported');
    }
    if (request.serviceIds.length) {
      const assigned = new Set(provider.providerServices.filter((item) => item.isActive).map((item) => item.serviceId));
      if (!request.serviceIds.every((id) => assigned.has(id))) reasons.push('service_not_supported');
    }
    if (request.locationId) {
      const location = await this.prisma.location.findUnique({ where: { id: request.locationId }, include: { parent: { include: { parent: true } } } });
      if (!location) reasons.push('location_not_found');
      else {
        const candidates = new Set<string>([location.id]);
        if (location.parentId) candidates.add(location.parentId);
        if (location.parent?.parentId) candidates.add(location.parent.parentId);
        if (!provider.serviceAreas.some((area) => candidates.has(area.locationId))) reasons.push('coverage_not_supported');
      }
    }
    return { eligible: reasons.length === 0, reasons };
  }

  async match(request: MatchingRequest): Promise<Array<{ providerProfileId: string; reasons: string[] }>> {
    const where: Prisma.ProviderProfileWhereInput = {
      isActive: true,
      deletedAt: null,
      verificationStatus: VerificationStatus.APPROVED,
      user: { status: UserStatus.ACTIVE, deletedAt: null },
      ...(request.categoryIds.length ? { categories: { every: { categoryId: { in: request.categoryIds } } } } : {}),
      ...(request.serviceIds.length ? { providerServices: { some: { serviceId: { in: request.serviceIds }, isActive: true } } } : {}),
    };
    const candidates = await this.prisma.providerProfile.findMany({ where, select: { id: true } });
    const matches: Array<{ providerProfileId: string; reasons: string[] }> = [];
    for (const candidate of candidates) {
      const result = await this.isEligible(candidate.id, request);
      if (result.eligible) matches.push({ providerProfileId: candidate.id, reasons: [] });
    }
    return matches.sort((a, b) => a.providerProfileId.localeCompare(b.providerProfileId));
  }

  async distribute(request: MatchingRequest): Promise<{ distributed: number; eligibleProviderIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const matches = await this.match(request);
      const uniqueIds = [...new Set(matches.map((match) => match.providerProfileId))];
      await tx.serviceRequestRecipient.createMany({
        data: uniqueIds.map((providerProfileId) => ({
          serviceRequestId: request.id,
          providerProfileId,
          deliveryStatus: DeliveryStatus.PENDING,
          responseStatus: ProviderResponseStatus.PENDING,
        })),
        skipDuplicates: true,
      });
      await tx.serviceRequest.update({ where: { id: request.id }, data: { status: 'OPEN' } });
      return { distributed: uniqueIds.length, eligibleProviderIds: uniqueIds };
    });
  }
}

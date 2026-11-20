import { ProviderMatchingService } from './provider-matching.service';
import { PrismaService } from '../../database/prisma.service';

describe('ProviderMatchingService', () => {
  const profile = {
    id: 'provider-1',
    isActive: true,
    deletedAt: null,
    verificationStatus: 'APPROVED',
    user: { status: 'ACTIVE', deletedAt: null },
    categories: [{ categoryId: 'category-1' }],
    providerServices: [{ serviceId: 'service-1', isActive: true }],
    serviceAreas: [{ locationId: 'district-1' }],
  };
  let prisma: {
    providerProfile: { findUnique: jest.Mock; findMany: jest.Mock };
    location: { findUnique: jest.Mock };
  };
  let service: ProviderMatchingService;

  beforeEach(() => {
    prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        findMany: jest.fn().mockResolvedValue([{ id: 'provider-1' }]),
      },
      location: { findUnique: jest.fn().mockResolvedValue({ id: 'district-1', parentId: null, parent: null }) },
    };
    service = new ProviderMatchingService(prisma as unknown as PrismaService);
  });

  it('accepts an eligible provider', async () => {
    await expect(service.isEligible('provider-1', {
      id: 'request-1',
      locationId: 'district-1',
      categoryIds: ['category-1'],
      serviceIds: ['service-1'],
    })).resolves.toEqual({ eligible: true, reasons: [] });
  });

  it('rejects unapproved, inactive, unsupported, or uncovered providers', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      ...profile,
      isActive: false,
      verificationStatus: 'PENDING',
      providerServices: [],
      serviceAreas: [],
    });
    const result = await service.isEligible('provider-1', {
      id: 'request-1',
      locationId: 'district-1',
      categoryIds: ['category-1'],
      serviceIds: ['service-1'],
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'profile_ineligible',
      'verification_not_approved',
      'service_not_supported',
      'coverage_not_supported',
    ]));
  });
});

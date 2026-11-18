import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { code: 'SUPER_ADMIN', name: 'Super administrator' },
  { code: 'ADMIN', name: 'Administrator' },
  { code: 'CUSTOMER', name: 'Customer' },
  { code: 'INDIVIDUAL_PROVIDER', name: 'Individual provider' },
  { code: 'BUSINESS_PROVIDER', name: 'Business provider' },
] as const;

const permissions = [
  'users.manage',
  'roles.manage',
  'system-settings.manage',
  'categories.manage',
  'services.manage',
  'locations.manage',
  'providers.manage',
  'providers.verify',
  'service-requests.manage',
  'quotations.manage',
  'bookings.manage',
  'reviews.moderate',
  'subscriptions.manage',
  'commissions.manage',
  'advertisements.manage',
  'payments.manage',
  'complaints.manage',
  'audit-logs.read',
  'customer-profile.manage',
  'service-requests.create',
  'quotations.read',
  'quotations.accept',
  'bookings.read',
  'reviews.create',
  'favourites.manage',
  'notifications.read',
  'enquiries.create',
  'provider-profile.manage',
  'provider-categories.manage',
  'provider-service-areas.manage',
  'provider-availability.manage',
  'provider-verifications.submit',
  'service-requests.read',
  'quotations.create',
  'reviews.respond',
  'provider-subscriptions.manage',
  'lead-transactions.manage',
] as const;

const categoryGroups = [
  {
    name: 'Home & Property',
    slug: 'home-property',
    services: [
      'Plumbing',
      'Electrical',
      'Painting',
      'Carpentry',
      'AC Repairs',
      'Cleaning',
      'Gardening',
      'Pest Control',
    ],
  },
  {
    name: 'Vehicle Services',
    slug: 'vehicle-services',
    services: [
      'Vehicle Repair',
      'Towing',
      'Vehicle Washing',
      'Detailing',
      'Tyres',
      'Batteries',
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    services: ['Salon Services', 'Bridal Dressing', 'Makeup', 'Grooming'],
  },
  {
    name: 'Education & Training',
    slug: 'education-training',
    services: [
      'Tuition',
      'Language Classes',
      'Music Lessons',
      'Sports Coaching',
    ],
  },
  {
    name: 'Events & Entertainment',
    slug: 'events-entertainment',
    services: [
      'Photography',
      'Videography',
      'DJs',
      'Event Planning',
      'Catering',
    ],
  },
  {
    name: 'IT & Professional',
    slug: 'it-professional',
    services: [
      'Web Development',
      'Graphic Design',
      'Accounting',
      'Digital Marketing',
      'Computer Repairs',
    ],
  },
  {
    name: 'Business & Office',
    slug: 'business-office',
    services: [
      'Office Cleaning',
      'Security',
      'Logistics',
      'Equipment Maintenance',
    ],
  },
] as const;

const provinces = [
  {
    name: 'Western',
    slug: 'western-province',
    districts: ['Colombo', 'Gampaha', 'Kalutara'],
  },
  {
    name: 'Central',
    slug: 'central-province',
    districts: ['Kandy', 'Matale', 'Nuwara Eliya'],
  },
  {
    name: 'Southern',
    slug: 'southern-province',
    districts: ['Galle', 'Matara', 'Hambantota'],
  },
  {
    name: 'Northern',
    slug: 'northern-province',
    districts: ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  },
  {
    name: 'Eastern',
    slug: 'eastern-province',
    districts: ['Batticaloa', 'Ampara', 'Trincomalee'],
  },
  {
    name: 'North Western',
    slug: 'north-western-province',
    districts: ['Kurunegala', 'Puttalam'],
  },
  {
    name: 'North Central',
    slug: 'north-central-province',
    districts: ['Anuradhapura', 'Polonnaruwa'],
  },
  {
    name: 'Uva',
    slug: 'uva-province',
    districts: ['Badulla', 'Monaragala'],
  },
  {
    name: 'Sabaragamuwa',
    slug: 'sabaragamuwa-province',
    districts: ['Ratnapura', 'Kegalle'],
  },
] as const;

const plans = [
  { code: 'FREE', name: 'Free', monthlyPrice: 0, isFeaturedEligible: false },
  {
    code: 'STANDARD',
    name: 'Standard',
    monthlyPrice: 1500,
    isFeaturedEligible: false,
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    monthlyPrice: 3000,
    isFeaturedEligible: true,
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    monthlyPrice: 5000,
    isFeaturedEligible: true,
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    monthlyPrice: 10000,
    isFeaturedEligible: true,
  },
] as const;

async function seedRolesAndPermissions(): Promise<void> {
  const roleRecords = new Map(
    await Promise.all(
      roles.map(async (role) => {
        const record = await prisma.role.upsert({
          where: { code: role.code },
          create: { ...role, isSystem: true },
          update: { name: role.name, isSystem: true },
          select: { id: true },
        });
        return [role.code, record] as const;
      }),
    ),
  );

  await prisma.permission.createMany({
    data: permissions.map((code) => ({ code })),
    skipDuplicates: true,
  });
  const permissionRecords = new Map(
    (
      await prisma.permission.findMany({
        where: { code: { in: [...permissions] } },
        select: { id: true, code: true },
      })
    ).map((record) => [record.code, record]),
  );

  const adminPermissions = permissions.filter(
    (permission) => permission !== 'system-settings.manage',
  );
  const customerPermissions = [
    'customer-profile.manage',
    'service-requests.create',
    'service-requests.read',
    'quotations.read',
    'quotations.accept',
    'bookings.read',
    'reviews.create',
    'favourites.manage',
    'notifications.read',
    'enquiries.create',
  ];
  const providerPermissions = [
    'provider-profile.manage',
    'provider-categories.manage',
    'provider-service-areas.manage',
    'provider-availability.manage',
    'provider-verifications.submit',
    'service-requests.read',
    'quotations.create',
    'bookings.read',
    'reviews.respond',
    'provider-subscriptions.manage',
    'lead-transactions.manage',
    'notifications.read',
    'enquiries.create',
  ];

  const rolePermissionCodes: Record<string, readonly string[]> = {
    SUPER_ADMIN: permissions,
    ADMIN: adminPermissions,
    CUSTOMER: customerPermissions,
    INDIVIDUAL_PROVIDER: providerPermissions,
    BUSINESS_PROVIDER: providerPermissions,
  };

  const rolePermissionRows = [];
  for (const [roleCode, permissionCodes] of Object.entries(
    rolePermissionCodes,
  )) {
    const role = roleRecords.get(roleCode);
    if (!role) throw new Error(`Missing seeded role: ${roleCode}`);

    for (const permissionCode of permissionCodes) {
      const permission = permissionRecords.get(permissionCode);
      if (!permission)
        throw new Error(`Missing seeded permission: ${permissionCode}`);
      rolePermissionRows.push({ roleId: role.id, permissionId: permission.id });
    }
  }
  await prisma.rolePermission.createMany({
    data: rolePermissionRows,
    skipDuplicates: true,
  });
}

async function seedLocations(): Promise<void> {
  const parents = new Map(
    await Promise.all(
      provinces.map(async (province) => {
        const parent = await prisma.location.upsert({
          where: { slug: province.slug },
          create: {
            name: province.name,
            slug: province.slug,
            type: 'PROVINCE',
          },
          update: { name: province.name, type: 'PROVINCE' },
          select: { id: true },
        });
        return [province.slug, parent] as const;
      }),
    ),
  );
  const districtRows = provinces.flatMap((province) => {
    const parent = parents.get(province.slug);
    if (!parent) throw new Error(`Missing seeded province: ${province.name}`);
    return province.districts.map((district) => ({
      name: district,
      slug: `${district.toLowerCase().replaceAll(' ', '-')}-district`,
      type: 'DISTRICT' as const,
      parentId: parent.id,
    }));
  });
  await prisma.location.createMany({
    data: districtRows,
    skipDuplicates: true,
  });
}

async function seedCategoriesAndServices(): Promise<void> {
  const parents = new Map(
    await Promise.all(
      categoryGroups.map(async (group, sortOrder) => {
        const parent = await prisma.category.upsert({
          where: { slug: group.slug },
          create: { name: group.name, slug: group.slug, sortOrder },
          update: { name: group.name, sortOrder },
          select: { id: true },
        });
        return [group.slug, parent] as const;
      }),
    ),
  );
  const children = categoryGroups.flatMap((group) => {
    const parent = parents.get(group.slug);
    if (!parent) throw new Error(`Missing seeded category: ${group.name}`);
    return group.services.map((name, sortOrder) => {
      const slug = name
        .toLowerCase()
        .replaceAll('&', 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return { name, slug, parentId: parent.id, sortOrder };
    });
  });
  await prisma.category.createMany({ data: children, skipDuplicates: true });
  const childCategories = await prisma.category.findMany({
    where: { slug: { in: children.map((category) => category.slug) } },
    select: { id: true, slug: true, name: true },
  });
  await prisma.service.createMany({
    data: childCategories.map((category) => ({
      categoryId: category.id,
      slug: category.slug,
      name: category.name,
      pricingType: 'QUOTE_BASED',
    })),
    skipDuplicates: true,
  });
}

async function seedSubscriptionPlans(): Promise<void> {
  await prisma.subscriptionPlan.createMany({
    data: plans.map((plan) => ({
      ...plan,
      benefits: [],
      currency: 'LKR',
      leadLimit: null,
    })),
    skipDuplicates: true,
  });
}

async function seedSystemSettings(): Promise<void> {
  const settings = [
    {
      key: 'platform.default_currency',
      value: 'LKR',
      description: 'Default currency for new marketplace prices.',
    },
    {
      key: 'platform.time_zone',
      value: 'Asia/Colombo',
      description: 'Platform display time zone; timestamps are stored in UTC.',
    },
  ];

  await prisma.systemSetting.createMany({
    data: settings,
    skipDuplicates: true,
  });
}

async function seedInitialAdministrator(): Promise<void> {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
  const passwordHash = process.env.INITIAL_ADMIN_PASSWORD_HASH?.trim();
  if (!email && !passwordHash) return;
  if (!email || !passwordHash) {
    throw new Error(
      'Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD_HASH, or leave both unset.',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INITIAL_ADMIN_EMAIL must be a valid email address.');
  }
  if (!/^\$argon2id\$/.test(passwordHash)) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD_HASH must be a precomputed Argon2id hash; plaintext is not accepted.',
    );
  }

  const normalizedEmail = email.toLowerCase();
  const user = await prisma.user.upsert({
    where: { normalizedEmail },
    create: {
      email,
      normalizedEmail,
      passwordHash,
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    update: {
      email,
      passwordHash,
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    select: { id: true },
  });
  const superAdmin = await prisma.role.findUniqueOrThrow({
    where: { code: 'SUPER_ADMIN' },
    select: { id: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
    create: { userId: user.id, roleId: superAdmin.id },
    update: {},
  });
}

async function main(): Promise<void> {
  await seedRolesAndPermissions();
  await seedLocations();
  await seedCategoriesAndServices();
  await seedSubscriptionPlans();
  await seedSystemSettings();
  await seedInitialAdministrator();
}

main()
  .then(() => console.info('SERV HUB reference data seeded successfully.'))
  .catch((error: unknown) => {
    console.error('SERV HUB seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

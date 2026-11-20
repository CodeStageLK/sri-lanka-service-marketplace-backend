import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateLocationDto, LocationSearchDto } from './locations.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private slug(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async provinces() {
    return this.prisma.location.findMany({ where: { type: LocationType.PROVINCE, isActive: true }, include: { children: { where: { isActive: true } } }, orderBy: { name: 'asc' } });
  }

  async province(idOrSlug: string) {
    const item = await this.prisma.location.findFirst({ where: { type: LocationType.PROVINCE, isActive: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } } });
    if (!item) throw new NotFoundException('Province not found.');
    return item;
  }

  async districts(provinceIdOrSlug: string) {
    const province = await this.prisma.location.findFirst({ where: { type: LocationType.PROVINCE, isActive: true, OR: [{ id: provinceIdOrSlug }, { slug: provinceIdOrSlug }] } });
    if (!province) throw new NotFoundException('Province not found.');
    return this.prisma.location.findMany({ where: { parentId: province.id, type: LocationType.DISTRICT, isActive: true }, include: { children: { where: { isActive: true } } }, orderBy: { name: 'asc' } });
  }

  async district(idOrSlug: string) {
    const item = await this.prisma.location.findFirst({ where: { type: LocationType.DISTRICT, isActive: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: { parent: true, children: { where: { isActive: true }, orderBy: { name: 'asc' } } } });
    if (!item) throw new NotFoundException('District not found.');
    return item;
  }

  async cities(districtIdOrSlug: string) {
    const district = await this.prisma.location.findFirst({ where: { type: LocationType.DISTRICT, isActive: true, OR: [{ id: districtIdOrSlug }, { slug: districtIdOrSlug }] } });
    if (!district) throw new NotFoundException('District not found.');
    return this.prisma.location.findMany({ where: { parentId: district.id, type: { in: [LocationType.CITY, LocationType.TOWN] }, isActive: true }, orderBy: { name: 'asc' } });
  }

  async search(query: LocationSearchDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LocationWhereInput = {
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { nameSi: { contains: query.search, mode: 'insensitive' } }, { nameTa: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({ where, include: { parent: true }, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.location.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async hierarchy(idOrSlug: string) {
    const item = await this.prisma.location.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true }, include: { parent: { include: { parent: true } }, children: { where: { isActive: true } } } });
    if (!item) throw new NotFoundException('Location not found.');
    return item;
  }

  async create(input: CreateLocationDto) {
    let expectedParent: LocationType | null = null;
    if (input.type === LocationType.DISTRICT) expectedParent = LocationType.PROVINCE;
    if (input.type === LocationType.CITY || input.type === LocationType.TOWN) expectedParent = LocationType.DISTRICT;
    if (input.type === LocationType.PROVINCE && input.parentId) throw new BadRequestException('A province cannot have a parent.');
    if (expectedParent && !input.parentId) throw new BadRequestException('A parent location is required.');
    if (input.parentId) {
      const parent = await this.prisma.location.findFirst({ where: { id: input.parentId, isActive: true } });
      if (!parent || parent.type !== expectedParent) throw new BadRequestException('Parent location type is invalid.');
    }
    const slug = input.slug ? this.slug(input.slug) : this.slug(input.name);
    if (!slug) throw new BadRequestException('A valid location slug is required.');
    return this.prisma.location.create({ data: { parentId: input.parentId ?? null, type: input.type, slug, name: input.name, isActive: input.isActive ?? true } });
  }

  async update(id: string, input: CreateLocationDto) {
    const existing = await this.prisma.location.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Location not found.');
    if (input.parentId !== undefined) {
      if (input.parentId === id) throw new BadRequestException('A location cannot be its own parent.');
      if (input.parentId) {
        const parent = await this.prisma.location.findUnique({ where: { id: input.parentId } });
        if (!parent) throw new BadRequestException('Parent location is invalid.');
        if (input.type === LocationType.DISTRICT && parent.type !== LocationType.PROVINCE) throw new BadRequestException('District parent must be a province.');
        if ((input.type === LocationType.CITY || input.type === LocationType.TOWN) && parent.type !== LocationType.DISTRICT) throw new BadRequestException('City or town parent must be a district.');
      }
    }
    return this.prisma.location.update({ where: { id }, data: {
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: this.slug(input.slug) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } });
  }
}

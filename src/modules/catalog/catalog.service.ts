import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto, CreateServiceDto, PaginationDto, UpdateCategoryDto, UpdateServiceDto } from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private slug(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async listCategories(query: PaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CategoryWhereInput = {
      isActive: true,
      deletedAt: null,
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameSi: { contains: query.search, mode: 'insensitive' } },
        { nameTa: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({ where, include: { children: { where: { isActive: true, deletedAt: null } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.category.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listCategoriesAdmin(query: PaginationDto & { active?: boolean }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CategoryWhereInput = {
      ...(typeof query.active === 'boolean' ? { isActive: query.active } : {}),
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.category.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getCategory(idOrSlug: string) {
    const category = await this.prisma.category.findFirst({
      where: { isActive: true, deletedAt: null, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { parent: true, children: { where: { isActive: true, deletedAt: null } }, services: { where: { isActive: true, deletedAt: null }, orderBy: { name: 'asc' } } },
    });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async createCategory(input: CreateCategoryDto) {
    if (input.parentId) {
      const parent = await this.prisma.category.findFirst({ where: { id: input.parentId, deletedAt: null } });
      if (!parent) throw new BadRequestException('Parent category is invalid.');
    }
    const slug = input.slug ? this.slug(input.slug) : this.slug(input.name);
    if (!slug) throw new BadRequestException('A valid category slug is required.');
    return this.prisma.category.create({ data: {
      parentId: input.parentId,
      slug,
      name: input.name,
      nameSi: input.nameSi,
      nameTa: input.nameTa,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    } });
  }

  async updateCategory(id: string, input: UpdateCategoryDto) {
    await this.getCategoryRecord(id);
    if (input.parentId) {
      if (input.parentId === id) throw new BadRequestException('A category cannot be its own parent.');
      const parent = await this.prisma.category.findFirst({ where: { id: input.parentId, deletedAt: null } });
      if (!parent) throw new BadRequestException('Parent category is invalid.');
    }
    return this.prisma.category.update({ where: { id }, data: {
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.slug || input.name ? { slug: this.slug(input.slug ?? input.name ?? '') } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nameSi !== undefined ? { nameSi: input.nameSi } : {}),
      ...(input.nameTa !== undefined ? { nameTa: input.nameTa } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } });
  }

  private async getCategoryRecord(id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async listServices(query: PaginationDto & { categoryId?: string; active?: boolean }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const isAdmin = typeof query.active === 'boolean';
    const where: Prisma.ServiceWhereInput = {
      ...(isAdmin ? { isActive: query.active } : { isActive: true }),
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({ where, include: { category: true }, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.service.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getService(idOrSlug: string) {
    const service = await this.prisma.service.findFirst({
      where: { deletedAt: null, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { category: true },
    });
    if (!service || !service.isActive) throw new NotFoundException('Service not found.');
    return service;
  }

  async createService(input: CreateServiceDto) {
    const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, deletedAt: null } });
    if (!category) throw new BadRequestException('Category is invalid.');
    const slug = input.slug ? this.slug(input.slug) : this.slug(input.name);
    if (!slug) throw new BadRequestException('A valid service slug is required.');
    return this.prisma.service.create({ data: {
      categoryId: input.categoryId,
      slug,
      name: input.name,
      description: input.description,
      pricingType: input.pricingType,
      priceFrom: input.priceFrom ? new Prisma.Decimal(input.priceFrom) : null,
      priceTo: input.priceTo ? new Prisma.Decimal(input.priceTo) : null,
      currency: input.currency ?? 'LKR',
      isActive: input.isActive ?? true,
    } });
  }

  async updateService(id: string, input: UpdateServiceDto) {
    const existing = await this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Service not found.');
    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, deletedAt: null } });
      if (!category) throw new BadRequestException('Category is invalid.');
    }
    return this.prisma.service.update({ where: { id }, data: {
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.slug || input.name ? { slug: this.slug(input.slug ?? input.name ?? '') } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.pricingType !== undefined ? { pricingType: input.pricingType } : {}),
      ...(input.priceFrom !== undefined ? { priceFrom: input.priceFrom ? new Prisma.Decimal(input.priceFrom) : null } : {}),
      ...(input.priceTo !== undefined ? { priceTo: input.priceTo ? new Prisma.Decimal(input.priceTo) : null } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } });
  }

  async deactivateService(id: string) {
    await this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }
}

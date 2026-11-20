import { Body, Controller, Get, Param, ParseBoolPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators/permissions.decorator';
import { Public } from '../../decorators/public.decorator';
import { CreateCategoryDto, CreateServiceDto, PaginationDto, UpdateCategoryDto, UpdateServiceDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @Public()
  listCategories(@Query() query: PaginationDto) { return this.catalog.listCategories(query); }

  @Get('categories/:idOrSlug')
  @Public()
  getCategory(@Param('idOrSlug') idOrSlug: string) { return this.catalog.getCategory(idOrSlug); }

  @Get('services')
  @Public()
  listServices(@Query() query: PaginationDto & { categoryId?: string }) { return this.catalog.listServices(query); }

  @Get('services/:idOrSlug')
  @Public()
  getService(@Param('idOrSlug') idOrSlug: string) { return this.catalog.getService(idOrSlug); }

  @Post('admin/categories')
  @ApiBearerAuth()
  @Permissions('categories.manage')
  createCategory(@Body() input: CreateCategoryDto) { return this.catalog.createCategory(input); }

  @Patch('admin/categories/:id')
  @ApiBearerAuth()
  @Permissions('categories.manage')
  updateCategory(@Param('id') id: string, @Body() input: UpdateCategoryDto) { return this.catalog.updateCategory(id, input); }

  @Patch('admin/categories/:id/status')
  @ApiBearerAuth()
  @Permissions('categories.manage')
  setCategoryStatus(@Param('id') id: string, @Query('active', ParseBoolPipe) active: boolean) {
    return this.catalog.updateCategory(id, { isActive: active });
  }

  @Post('admin/services')
  @ApiBearerAuth()
  @Permissions('services.manage')
  createService(@Body() input: CreateServiceDto) { return this.catalog.createService(input); }

  @Patch('admin/services/:id')
  @ApiBearerAuth()
  @Permissions('services.manage')
  updateService(@Param('id') id: string, @Body() input: UpdateServiceDto) { return this.catalog.updateService(id, input); }

  @Patch('admin/services/:id/status')
  @ApiBearerAuth()
  @Permissions('services.manage')
  setServiceStatus(@Param('id') id: string, @Query('active', ParseBoolPipe) active: boolean) {
    return this.catalog.updateService(id, { isActive: active, categoryId: '' });
  }

  @Get('admin/categories')
  @ApiBearerAuth()
  @Permissions('categories.manage')
  adminCategories(@Query() query: PaginationDto & { active?: boolean }) { return this.catalog.listCategoriesAdmin(query); }

  @Get('admin/services')
  @ApiBearerAuth()
  @Permissions('services.manage')
  adminServices(@Query() query: PaginationDto & { categoryId?: string; active?: boolean }) { return this.catalog.listServices(query); }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators/permissions.decorator';
import { Public } from '../../decorators/public.decorator';
import { CreateLocationDto, LocationSearchDto } from './locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('provinces') @Public() provinces() { return this.locations.provinces(); }
  @Get('provinces/:idOrSlug') @Public() province(@Param('idOrSlug') id: string) { return this.locations.province(id); }
  @Get('provinces/:provinceId/districts') @Public() districts(@Param('provinceId') id: string) { return this.locations.districts(id); }
  @Get('districts/:idOrSlug') @Public() district(@Param('idOrSlug') id: string) { return this.locations.district(id); }
  @Get('districts/:districtId/cities') @Public() cities(@Param('districtId') id: string) { return this.locations.cities(id); }
  @Get('search') @Public() search(@Query() query: LocationSearchDto) { return this.locations.search(query); }
  @Get(':idOrSlug/hierarchy') @Public() hierarchy(@Param('idOrSlug') id: string) { return this.locations.hierarchy(id); }

  @Post('admin') @ApiBearerAuth() @Permissions('locations.manage') create(@Body() input: CreateLocationDto) { return this.locations.create(input); }
  @Patch('admin/:id') @ApiBearerAuth() @Permissions('locations.manage') update(@Param('id') id: string, @Body() input: CreateLocationDto) { return this.locations.update(id, input); }
}

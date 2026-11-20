import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Permissions } from '../../decorators/permissions.decorator';
import { Public } from '../../decorators/public.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { ProviderAvailabilityDto, ProviderCategoryDto, ProviderCoverageDto, ProviderSearchDto, ProviderServiceDto, UpdateBusinessDetailsDto, UpdateProviderProfileDto } from './providers.dto';
import { ProvidersService } from './providers.service';

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get('search') @Public() search(@Query() query: ProviderSearchDto) { return this.providers.search(query); }
  @Get('service/:serviceId') @Public() forService(@Param('serviceId') serviceId: string) { return this.providers.providersForService(serviceId); }
  @Get('location/:locationId') @Public() atLocation(@Param('locationId') locationId: string) { return this.providers.providersAtLocation(locationId); }
  @Get('public/:idOrSlug') @Public() publicDetail(@Param('idOrSlug') idOrSlug: string) { return this.providers.publicDetail(idOrSlug); }

  @Get('me') @ApiBearerAuth() me(@CurrentUser() principal: AuthPrincipal) { return this.providers.me(principal); }
  @Patch('me') @ApiBearerAuth() update(@CurrentUser() principal: AuthPrincipal, @Body() input: UpdateProviderProfileDto) { return this.providers.updateProfile(principal, input); }
  @Put('me/business') @ApiBearerAuth() updateBusiness(@CurrentUser() principal: AuthPrincipal, @Body() input: UpdateBusinessDetailsDto) { return this.providers.updateBusiness(principal, input); }
  @Get('me/completion') @ApiBearerAuth() completion(@CurrentUser() principal: AuthPrincipal) { return this.providers.completion(principal); }
  @Get('me/categories') @ApiBearerAuth() categories(@CurrentUser() principal: AuthPrincipal) { return this.providers.categories(principal); }
  @Post('me/categories') @ApiBearerAuth() addCategory(@CurrentUser() principal: AuthPrincipal, @Body() input: ProviderCategoryDto) { return this.providers.addCategory(principal, input); }
  @Delete('me/categories/:categoryId') @ApiBearerAuth() removeCategory(@CurrentUser() principal: AuthPrincipal, @Param('categoryId') categoryId: string) { return this.providers.removeCategory(principal, categoryId); }
  @Get('me/services') @ApiBearerAuth() services(@CurrentUser() principal: AuthPrincipal) { return this.providers.services(principal); }
  @Post('me/services') @ApiBearerAuth() addService(@CurrentUser() principal: AuthPrincipal, @Body() input: ProviderServiceDto) { return this.providers.addService(principal, input); }
  @Patch('me/services/:serviceId') @ApiBearerAuth() updateService(@CurrentUser() principal: AuthPrincipal, @Param('serviceId') serviceId: string, @Body() input: ProviderServiceDto) { return this.providers.updateService(principal, serviceId, input); }
  @Delete('me/services/:serviceId') @ApiBearerAuth() removeService(@CurrentUser() principal: AuthPrincipal, @Param('serviceId') serviceId: string) { return this.providers.removeService(principal, serviceId); }
  @Get('me/coverage') @ApiBearerAuth() coverage(@CurrentUser() principal: AuthPrincipal) { return this.providers.coverage(principal); }
  @Post('me/coverage') @ApiBearerAuth() addCoverage(@CurrentUser() principal: AuthPrincipal, @Body() input: ProviderCoverageDto) { return this.providers.addCoverage(principal, input); }
  @Delete('me/coverage/:locationId') @ApiBearerAuth() removeCoverage(@CurrentUser() principal: AuthPrincipal, @Param('locationId') locationId: string) { return this.providers.removeCoverage(principal, locationId); }
  @Get('me/availability') @ApiBearerAuth() availability(@CurrentUser() principal: AuthPrincipal) { return this.providers.availability(principal); }
  @Put('me/availability') @ApiBearerAuth() updateAvailability(@CurrentUser() principal: AuthPrincipal, @Body() input: ProviderAvailabilityDto) { return this.providers.updateAvailability(principal, input); }
  @Delete('me/availability/:dayOfWeek') @ApiBearerAuth() removeAvailability(@CurrentUser() principal: AuthPrincipal, @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number) { return this.providers.removeAvailability(principal, dayOfWeek); }

  @Get('admin/:id/review') @ApiBearerAuth() @Permissions('providers.manage') adminReview(@Param('id') id: string) { return this.providers.adminReview(id); }
}

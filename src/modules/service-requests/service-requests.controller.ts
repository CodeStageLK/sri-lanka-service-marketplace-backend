import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Permissions } from '../../decorators/permissions.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { CreateServiceRequestDto, UpdateServiceRequestDto } from './service-requests.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('service requests')
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}

  @Post() @ApiBearerAuth() @Permissions('service-requests.create') create(@CurrentUser() principal: AuthPrincipal, @Body() input: CreateServiceRequestDto) { return this.requests.create(principal, input); }
  @Get() @ApiBearerAuth() @Permissions('service-requests.read') list(@CurrentUser() principal: AuthPrincipal) { return this.requests.list(principal); }
  @Get(':id') @ApiBearerAuth() @Permissions('service-requests.read') detail(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) { return this.requests.detail(principal, id); }
  @Patch(':id') @ApiBearerAuth() @Permissions('service-requests.create') update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() input: UpdateServiceRequestDto) { return this.requests.update(principal, id, input); }
  @Delete(':id') @ApiBearerAuth() @Permissions('service-requests.create') cancel(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) { return this.requests.cancel(principal, id); }
  @Post(':id/submit') @ApiBearerAuth() @Permissions('service-requests.create') submit(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) { return this.requests.submit(principal, id); }
}

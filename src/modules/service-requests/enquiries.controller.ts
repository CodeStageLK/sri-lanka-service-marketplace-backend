import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators/permissions.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { CreateEnquiryDto } from './service-requests.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('enquiries')
@Controller()
export class EnquiriesController {
  constructor(private readonly requests: ServiceRequestsService) {}

  @Get('provider/assigned-requests') @ApiBearerAuth() assigned(@CurrentUser() principal: AuthPrincipal) { return this.requests.providerAssigned(principal); }
  @Get('provider/assigned-requests/:requestId') @ApiBearerAuth() assignedDetail(@CurrentUser() principal: AuthPrincipal, @Param('requestId') requestId: string) { return this.requests.providerAssignedDetail(principal, requestId); }
  @Post('enquiries') @ApiBearerAuth() @Permissions('enquiries.create') create(@CurrentUser() principal: AuthPrincipal, @Body() input: CreateEnquiryDto) { return this.requests.createEnquiry(principal, input); }
  @Get('provider/enquiries') @ApiBearerAuth() providerEnquiries(@CurrentUser() principal: AuthPrincipal) { return this.requests.providerEnquiries(principal); }
  @Get('customer/enquiries') @ApiBearerAuth() @Permissions('service-requests.read') customerEnquiries(@CurrentUser() principal: AuthPrincipal) { return this.requests.customerEnquiries(principal); }
}

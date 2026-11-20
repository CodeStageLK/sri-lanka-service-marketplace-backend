import { Module } from '@nestjs/common';
import { ProviderMatchingModule } from '../provider-matching/provider-matching.module';
import { EnquiriesController } from './enquiries.controller';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  imports: [ProviderMatchingModule],
  controllers: [ServiceRequestsController, EnquiriesController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}

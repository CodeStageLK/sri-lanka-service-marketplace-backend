import { Module } from '@nestjs/common';
import { ProviderMatchingService } from './provider-matching.service';

@Module({
  providers: [ProviderMatchingService],
  exports: [ProviderMatchingService],
})
export class ProviderMatchingModule {}

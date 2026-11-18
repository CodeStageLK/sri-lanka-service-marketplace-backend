import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PROVIDER_VERIFICATION_KEY =
  'requiresProviderVerification';
export const RequiresProviderVerification = () =>
  SetMetadata(REQUIRES_PROVIDER_VERIFICATION_KEY, true);

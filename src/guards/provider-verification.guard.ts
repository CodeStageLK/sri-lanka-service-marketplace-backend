import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRES_PROVIDER_VERIFICATION_KEY } from '../decorators/requires-provider-verification.decorator';
import type { AuthPrincipal } from '../modules/auth/auth.types';

@Injectable()
export class ProviderVerificationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_PROVIDER_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const principal = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthPrincipal }>().user;
    if (!principal) {
      throw new UnauthorizedException('Authentication is required.');
    }
    if (principal.providerProfile?.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException('Provider verification is required.');
    }
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthPrincipal } from '../modules/auth/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const principal = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthPrincipal }>().user;
    if (!principal) {
      throw new UnauthorizedException('Authentication is required.');
    }
    const hasAllowedRole = requiredRoles.some((role) => {
      if (!principal.roles.includes(role)) return false;
      if (['INDIVIDUAL_PROVIDER', 'BUSINESS_PROVIDER'].includes(role)) {
        return Boolean(principal.providerProfile?.isActive);
      }
      return true;
    });
    if (!hasAllowedRole) {
      throw new ForbiddenException('Insufficient role or inactive provider account.');
    }
    return true;
  }
}

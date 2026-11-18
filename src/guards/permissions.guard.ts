import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthPrincipal } from '../modules/auth/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) return true;

    const principal = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthPrincipal }>().user;
    if (!principal) {
      throw new UnauthorizedException('Authentication is required.');
    }
    if (
      !requiredPermissions.every((permission) =>
        principal.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Insufficient permission.');
    }
    return true;
  }
}

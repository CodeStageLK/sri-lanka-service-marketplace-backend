import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService, type JwtVerifyOptions } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthService } from '../modules/auth/auth.service';
import type { AccessTokenClaims, AuthPrincipal } from '../modules/auth/auth.types';

interface AuthenticatedRequest extends Request {
  user?: AuthPrincipal;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication is required.');
    }

    let claims: AccessTokenClaims;
    try {
      const options: JwtVerifyOptions = {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
      };
      const issuer = this.config.get<string>('JWT_ISSUER');
      const audience = this.config.get<string>('JWT_AUDIENCE');
      if (issuer) options.issuer = issuer;
      if (audience) options.audience = audience;
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, options);
    } catch {
      throw new UnauthorizedException('Authentication is required.');
    }

    if (
      typeof claims.sub !== 'string' ||
      typeof claims.sessionId !== 'string' ||
      claims.tokenUse !== 'access'
    ) {
      throw new UnauthorizedException('Authentication is required.');
    }
    request.user = await this.auth.authenticateSession(
      claims.sub,
      claims.sessionId,
    );
    return true;
  }
}

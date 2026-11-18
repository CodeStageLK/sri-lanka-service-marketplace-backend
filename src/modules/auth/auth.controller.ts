import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';
import type { AuthPrincipal, ClientType } from './auth.types';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  RefreshDto,
  RegisterBusinessProviderDto,
  RegisterCustomerDto,
  RegisterIndividualProviderDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { AuthService } from './auth.service';

const REFRESH_COOKIE = 'servhub_refresh';
const CSRF_COOKIE = 'servhub_csrf';
const AUTH_COOKIE_PATH = '/api/v1/auth';

class RegistrationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty({ enum: ['accepted', 'not_configured'] })
  emailDelivery!: string;
}

class AuthResponse {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiPropertyOptional()
  csrfToken?: string;

  @ApiPropertyOptional({
    description: 'Returned only to mobile clients; web refresh tokens are HttpOnly cookies.',
  })
  refreshToken?: string;
}

class MessageResponse {
  @ApiProperty()
  message!: string;
}

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register/customer')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiCreatedResponse({ type: RegistrationResponse })
  @ApiConflictResponse({ description: 'The registration details cannot be used.' })
  registerCustomer(
    @Body() input: RegisterCustomerDto,
    @Req() request: Request,
  ): Promise<RegistrationResponse> {
    return this.auth.registerCustomer(input, this.metadata(request)).then(
      (result) => ({ ...result, status: 'PENDING' }),
    );
  }

  @Post('register/provider/individual')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register an individual provider account' })
  @ApiCreatedResponse({ type: RegistrationResponse })
  @ApiConflictResponse({ description: 'The registration details cannot be used.' })
  registerIndividualProvider(
    @Body() input: RegisterIndividualProviderDto,
    @Req() request: Request,
  ): Promise<RegistrationResponse> {
    return this.auth
      .registerIndividualProvider(input, this.metadata(request))
      .then((result) => ({ ...result, status: 'PENDING' }));
  }

  @Post('register/provider/business')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a business provider account' })
  @ApiCreatedResponse({ type: RegistrationResponse })
  @ApiConflictResponse({ description: 'The registration details cannot be used.' })
  registerBusinessProvider(
    @Body() input: RegisterBusinessProviderDto,
    @Req() request: Request,
  ): Promise<RegistrationResponse> {
    return this.auth
      .registerBusinessProvider(input, this.metadata(request))
      .then((result) => ({ ...result, status: 'PENDING' }));
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or inactive account.' })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const clientType: ClientType = input.clientType ?? 'WEB';
    const pair = await this.auth.login(
      input.email,
      input.password,
      this.metadata(request),
      clientType,
      input.deviceName,
    );
    let csrfToken: string | undefined;
    if (clientType === 'WEB') {
      csrfToken = this.setRefreshCookies(
        response,
        pair.refreshToken,
        pair.refreshExpiresAt,
      );
    }
    return {
      accessToken: pair.accessToken,
      tokenType: 'Bearer',
      expiresIn: pair.expiresIn,
      ...(csrfToken ? { csrfToken } : {}),
      ...(clientType === 'MOBILE' ? { refreshToken: pair.refreshToken } : {}),
    };
  }

  @Get('csrf')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Issue the CSRF token required for cookie-based refresh' })
  @ApiOkResponse({ schema: { properties: { csrfToken: { type: 'string' } } } })
  csrf(
    @Res({ passthrough: true }) response: Response,
  ): { csrfToken: string } {
    const csrfToken = randomBytes(32).toString('base64url');
    response.cookie(CSRF_COOKIE, csrfToken, {
      ...this.cookieOptions(),
      httpOnly: false,
    });
    return { csrfToken };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or reused refresh token.' })
  async refresh(
    @Body() input: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const cookies = this.cookies(request);
    const cookieToken = cookies[REFRESH_COOKIE];
    if (cookieToken) this.assertCsrf(request, cookies[CSRF_COOKIE]);
    const token = cookieToken ?? input.refreshToken;
    if (!token) throw new UnauthorizedException('A refresh token is required.');

    const pair = await this.auth.refresh(token, this.metadata(request));
    if (cookieToken) {
      this.setRefreshCookie(
        response,
        pair.refreshToken,
        pair.refreshExpiresAt,
      );
    }
    return {
      accessToken: pair.accessToken,
      tokenType: 'Bearer',
      expiresIn: pair.expiresIn,
      ...(!cookieToken ? { refreshToken: pair.refreshToken } : {}),
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiNoContentResponse()
  async logout(
    @CurrentUser() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(principal);
    this.clearRefreshCookies(response);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions for the authenticated user' })
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentUser() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(principal);
    this.clearRefreshCookies(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user and current RBAC grants' })
  @ApiOkResponse()
  currentUser(@CurrentUser() principal: AuthPrincipal): Omit<AuthPrincipal, 'sessionId'> {
    return {
      id: principal.id,
      email: principal.email,
      isEmailVerified: principal.isEmailVerified,
      roles: principal.roles,
      permissions: principal.permissions,
      customerProfile: principal.customerProfile,
      providerProfile: principal.providerProfile,
    };
  }

  @Post('email/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify an email address with a single-use token' })
  @ApiOkResponse({ type: MessageResponse })
  @ApiUnauthorizedResponse({ description: 'The token is invalid, expired, or already used.' })
  async verifyEmail(@Body() input: VerifyEmailDto): Promise<MessageResponse> {
    await this.auth.verifyEmail(input.token);
    return { message: 'Email verified.' };
  }

  @Post('email/resend')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Request another email verification message' })
  @ApiAcceptedResponse({ type: MessageResponse })
  async resendVerification(@Body() input: EmailDto): Promise<MessageResponse> {
    await this.auth.resendVerification(input.email);
    return {
      message: 'If the account exists and is not verified, instructions will be sent.',
    };
  }

  @Post('password/forgot')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Request a password reset without revealing account existence' })
  @ApiAcceptedResponse({ type: MessageResponse })
  async forgotPassword(@Body() input: EmailDto): Promise<MessageResponse> {
    await this.auth.requestPasswordReset(input.email);
    return {
      message: 'If the account exists, password reset instructions will be sent.',
    };
  }

  @Post('password/reset')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Reset a password with a single-use token' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'The token is invalid, expired, or already used.' })
  resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(input.token, input.newPassword);
  }

  @Post('password/change')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Change the password and revoke every active session' })
  @ApiNoContentResponse()
  async changePassword(
    @Body() input: ChangePasswordDto,
    @CurrentUser() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(
      principal,
      input.currentPassword,
      input.newPassword,
    );
    this.clearRefreshCookies(response);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions belonging to the authenticated user' })
  @ApiOkResponse()
  sessions(@CurrentUser() principal: AuthPrincipal) {
    return this.auth.listSessions(principal);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one of the authenticated user’s sessions' })
  @ApiNoContentResponse()
  revokeSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() principal: AuthPrincipal,
  ): Promise<void> {
    return this.auth.revokeSession(principal, sessionId);
  }

  private metadata(request: Request): {
    ipAddress?: string;
    userAgent?: string;
  } {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    };
  }

  private cookies(request: Request): Record<string, string> {
    return request.cookies ?? {};
  }

  private assertCsrf(request: Request, csrfCookie?: string): void {
    const csrfHeader = request.get('x-csrf-token');
    if (
      !csrfCookie ||
      !csrfHeader ||
      csrfCookie.length !== csrfHeader.length ||
      !timingSafeEqual(Buffer.from(csrfCookie), Buffer.from(csrfHeader))
    ) {
      throw new ForbiddenException('CSRF validation failed.');
    }
  }

  private setRefreshCookies(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): string {
    const csrfToken = randomBytes(32).toString('base64url');
    response.cookie(CSRF_COOKIE, csrfToken, {
      ...this.cookieOptions(),
      httpOnly: false,
    });
    this.setRefreshCookie(response, refreshToken, expiresAt);
    return csrfToken;
  }

  private setRefreshCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.cookieOptions(),
      httpOnly: true,
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  private clearRefreshCookies(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, {
      ...this.cookieOptions(),
      httpOnly: true,
    });
    response.clearCookie(CSRF_COOKIE, {
      ...this.cookieOptions(),
      httpOnly: false,
    });
  }

  private cookieOptions(): {
    path: string;
    secure: boolean;
    sameSite: 'strict';
  } {
    return {
      path: AUTH_COOKIE_PATH,
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
    };
  }
}

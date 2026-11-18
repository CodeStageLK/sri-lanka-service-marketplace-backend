import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose, Prisma, UserStatus } from '@prisma/client';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  RegisterBusinessProviderDto,
  RegisterCustomerDto,
  RegisterIndividualProviderDto,
} from './dto/auth.dto';
import type {
  AuthPrincipal,
  ClientType,
  SafeSession,
  TokenPair,
} from './auth.types';
import { EmailService, type EmailDeliveryStatus } from './email.service';
import { PasswordService } from './password.service';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const TOKEN_BYTES = 32;

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface RegistrationResult {
  id: string;
  email: string;
  emailDelivery: 'accepted' | 'not_configured';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerCustomer(
    input: RegisterCustomerDto,
    metadata: RequestMetadata,
  ): Promise<RegistrationResult> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);
    const token = this.createOpaqueToken();
    const tokenHash = this.hashToken(token);
    let user: { id: string; email: string };

    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const role = await transaction.role.findUnique({
          where: { code: 'CUSTOMER' },
          select: { id: true },
        });
        if (!role) {
          throw new InternalServerErrorException(
            'The customer role has not been seeded.',
          );
        }

        const created = await transaction.user.create({
          data: {
            email,
            normalizedEmail: email,
            passwordHash,
            status: UserStatus.PENDING,
            customerProfile: {
              create: {
                firstName: input.firstName.trim(),
                lastName: input.lastName.trim(),
                preferredContactEmail: email,
              },
            },
            roles: {
              create: { role: { connect: { id: role.id } } },
            },
          },
          select: { id: true, email: true },
        });
        await this.createAuthToken(
          transaction,
          created.id,
          AuthTokenPurpose.EMAIL_VERIFICATION,
          tokenHash,
          EMAIL_VERIFICATION_TTL_MS,
        );
        await this.writeAudit(transaction, {
          actorId: created.id,
          action: 'auth.registration.customer',
          entityType: 'user',
          entityId: created.id,
          metadata,
        });
        return { id: created.id, email: created.email ?? email };
      });
    } catch (error) {
      this.throwRegistrationConflict(error);
    }

    const emailDelivery = await this.sendRegistrationVerification(
      user.email,
      token,
    );
    return { ...user, emailDelivery };
  }

  async registerIndividualProvider(
    input: RegisterIndividualProviderDto,
    metadata: RequestMetadata,
  ): Promise<RegistrationResult> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);
    const token = this.createOpaqueToken();
    const tokenHash = this.hashToken(token);
    let user: { id: string; email: string };

    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const role = await transaction.role.findUnique({
          where: { code: 'INDIVIDUAL_PROVIDER' },
          select: { id: true },
        });
        if (!role) {
          throw new InternalServerErrorException(
            'The individual provider role has not been seeded.',
          );
        }

        const created = await transaction.user.create({
          data: {
            email,
            normalizedEmail: email,
            passwordHash,
            status: UserStatus.PENDING,
            providerProfile: {
              create: {
                providerType: 'INDIVIDUAL',
                displayName: input.displayName.trim(),
                contactEmail: email,
                contactPhone: input.contactPhone?.trim(),
              },
            },
            roles: {
              create: { role: { connect: { id: role.id } } },
            },
          },
          select: { id: true, email: true },
        });
        await this.createAuthToken(
          transaction,
          created.id,
          AuthTokenPurpose.EMAIL_VERIFICATION,
          tokenHash,
          EMAIL_VERIFICATION_TTL_MS,
        );
        await this.writeAudit(transaction, {
          actorId: created.id,
          action: 'auth.registration.individual_provider',
          entityType: 'user',
          entityId: created.id,
          metadata,
        });
        return { id: created.id, email: created.email ?? email };
      });
    } catch (error) {
      this.throwRegistrationConflict(error);
    }

    const emailDelivery = await this.sendRegistrationVerification(
      user.email,
      token,
    );
    return { ...user, emailDelivery };
  }

  async registerBusinessProvider(
    input: RegisterBusinessProviderDto,
    metadata: RequestMetadata,
  ): Promise<RegistrationResult> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);
    const token = this.createOpaqueToken();
    const tokenHash = this.hashToken(token);
    let user: { id: string; email: string };

    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const role = await transaction.role.findUnique({
          where: { code: 'BUSINESS_PROVIDER' },
          select: { id: true },
        });
        if (!role) {
          throw new InternalServerErrorException(
            'The business provider role has not been seeded.',
          );
        }

        const created = await transaction.user.create({
          data: {
            email,
            normalizedEmail: email,
            passwordHash,
            status: UserStatus.PENDING,
            providerProfile: {
              create: {
                providerType: 'BUSINESS',
                displayName: input.businessName.trim(),
                contactEmail: email,
                contactPhone: input.contactPhone?.trim(),
                businessDetails: {
                  create: {
                    businessName: input.businessName.trim(),
                    registrationNumber: input.registrationNumber?.trim(),
                    businessAddress: input.businessAddress?.trim(),
                    contactPersonName: input.contactPersonName?.trim(),
                    contactEmail: email,
                    contactPhone: input.contactPhone?.trim(),
                  },
                },
              },
            },
            roles: {
              create: { role: { connect: { id: role.id } } },
            },
          },
          select: { id: true, email: true },
        });
        await this.createAuthToken(
          transaction,
          created.id,
          AuthTokenPurpose.EMAIL_VERIFICATION,
          tokenHash,
          EMAIL_VERIFICATION_TTL_MS,
        );
        await this.writeAudit(transaction, {
          actorId: created.id,
          action: 'auth.registration.business_provider',
          entityType: 'user',
          entityId: created.id,
          metadata,
        });
        return { id: created.id, email: created.email ?? email };
      });
    } catch (error) {
      this.throwRegistrationConflict(error);
    }

    const emailDelivery = await this.sendRegistrationVerification(
      user.email,
      token,
    );
    return { ...user, emailDelivery };
  }

  async login(
    emailInput: string,
    password: string,
    metadata: RequestMetadata,
    clientType: ClientType,
    deviceName?: string,
  ): Promise<TokenPair & { clientType: ClientType }> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findFirst({
      where: { normalizedEmail: email, deletedAt: null },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        isEmailVerified: true,
      },
    });

    const passwordValid = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, password)
      : await this.verifyUnknownAccount(password);
    if (
      !user ||
      !passwordValid ||
      user.status !== UserStatus.ACTIVE ||
      !user.isEmailVerified
    ) {
      await this.writeFailedLogin(user?.id, metadata);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const refreshToken = this.createOpaqueToken();
    const refreshHash = this.hashToken(refreshToken);
    const now = new Date();
    const expiresAt = this.refreshExpiry(now);
    const session = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.userSession.create({
        data: {
          userId: user.id,
          tokenHash: refreshHash,
          ipAddress: metadata.ipAddress,
          userAgent: this.limitUserAgent(metadata.userAgent),
          deviceName: deviceName?.trim().slice(0, 120),
          expiresAt,
          lastSeenAt: now,
        },
        select: { id: true },
      });
      await transaction.refreshToken.create({
        data: {
          userId: user.id,
          sessionId: created.id,
          tokenHash: refreshHash,
          expiresAt,
        },
      });
      await this.writeAudit(transaction, {
        actorId: user.id,
        action: 'auth.login.succeeded',
        entityType: 'user_session',
        entityId: created.id,
        metadata: { ...metadata, clientType },
      });
      return created;
    });

    const accessToken = await this.createAccessToken(user.id, session.id);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      refreshExpiresAt: expiresAt,
      clientType,
    };
  }

  async refresh(rawToken: string, metadata: RequestMetadata): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        expiresAt: true,
        revokedAt: true,
        session: {
          select: { revokedAt: true, expiresAt: true, tokenHash: true },
        },
        user: {
          select: { status: true, isEmailVerified: true, deletedAt: true },
        },
      },
    });
    const sessionId = stored?.sessionId;
    if (!stored || !sessionId || !stored.session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (
      stored.revokedAt ||
      stored.session.revokedAt ||
      !this.equalTokenHashes(stored.session.tokenHash, tokenHash)
    ) {
      await this.revokeSessionFamily(
        sessionId,
        stored.userId,
        'auth.refresh.reuse_detected',
      );
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const now = new Date();
    if (
      stored.expiresAt <= now ||
      stored.session.expiresAt <= now ||
      stored.user.status !== UserStatus.ACTIVE ||
      !stored.user.isEmailVerified ||
      stored.user.deletedAt
    ) {
      await this.revokeSessionFamily(
        sessionId,
        stored.userId,
        'auth.refresh.rejected',
      );
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const nextToken = this.createOpaqueToken();
    const nextHash = this.hashToken(nextToken);
    const nextExpiry = stored.session.expiresAt;
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: {
          id: stored.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        await this.revokeSessionInTransaction(
          transaction,
          sessionId,
          stored.userId,
          'auth.refresh.reuse_detected',
        );
        return false;
      }

      const sessionUpdate = await transaction.userSession.updateMany({
        where: {
          id: sessionId,
          userId: stored.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          tokenHash: nextHash,
          lastSeenAt: now,
          ipAddress: metadata.ipAddress,
          userAgent: this.limitUserAgent(metadata.userAgent),
        },
      });
      if (sessionUpdate.count !== 1) {
        await this.revokeSessionInTransaction(
          transaction,
          sessionId,
          stored.userId,
          'auth.refresh.rejected',
        );
        return false;
      }

      await transaction.refreshToken.create({
        data: {
          userId: stored.userId,
          sessionId,
          tokenHash: nextHash,
          expiresAt: nextExpiry,
        },
      });
      await this.writeAudit(transaction, {
        actorId: stored.userId,
        action: 'auth.refresh.succeeded',
        entityType: 'user_session',
        entityId: sessionId,
        metadata,
      });
      return true;
    });
    if (!rotated) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return {
      accessToken: await this.createAccessToken(
        stored.userId,
        sessionId,
      ),
      refreshToken: nextToken,
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      refreshExpiresAt: nextExpiry,
    };
  }

  async authenticateSession(
    userId: string,
    sessionId: string,
  ): Promise<AuthPrincipal> {
    const now = new Date();
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        user: {
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            isEmailVerified: true,
            roles: {
              select: {
                role: {
                  select: {
                    code: true,
                    permissions: {
                      select: { permission: { select: { code: true } } },
                    },
                  },
                },
              },
            },
            customerProfile: {
              select: { firstName: true, lastName: true },
            },
            providerProfile: {
              select: {
                id: true,
                providerType: true,
                verificationStatus: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
    if (!session?.user?.email) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const roles = session.user.roles.map(({ role }) => role);
    return {
      id: session.user.id,
      email: session.user.email,
      isEmailVerified: session.user.isEmailVerified,
      sessionId: session.id,
      roles: roles.map((role) => role.code),
      permissions: [
        ...new Set(
          roles.flatMap((role) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ],
      customerProfile: session.user.customerProfile,
      providerProfile: session.user.providerProfile,
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const stored = await this.prisma.authToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: { id: true, userId: true, purpose: true, expiresAt: true, consumedAt: true },
    });
    const now = new Date();
    if (
      !stored ||
      stored.purpose !== AuthTokenPurpose.EMAIL_VERIFICATION ||
      stored.consumedAt ||
      stored.expiresAt <= now
    ) {
      throw new UnauthorizedException('Invalid or expired verification token.');
    }

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.authToken.updateMany({
        where: {
          id: stored.id,
          purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException(
          'Invalid or expired verification token.',
        );
      }
      await transaction.user.update({
        where: { id: stored.userId },
        data: {
          isEmailVerified: true,
        },
      });
      await transaction.user.updateMany({
        where: { id: stored.userId, status: UserStatus.PENDING },
        data: { status: UserStatus.ACTIVE },
      });
      await this.writeAudit(transaction, {
        actorId: stored.userId,
        action: 'auth.email.verified',
        entityType: 'user',
        entityId: stored.userId,
      });
    });
  }

  async resendVerification(emailInput: string): Promise<void> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findFirst({
      where: {
        normalizedEmail: email,
        isEmailVerified: false,
        deletedAt: null,
      },
      select: { id: true, email: true },
    });
    if (!user?.email) return;

    const token = this.createOpaqueToken();
    await this.prisma.$transaction(async (transaction) => {
      await this.createAuthToken(
        transaction,
        user.id,
        AuthTokenPurpose.EMAIL_VERIFICATION,
        this.hashToken(token),
        EMAIL_VERIFICATION_TTL_MS,
      );
      await this.writeAudit(transaction, {
        actorId: user.id,
        action: 'auth.email_verification.resend_requested',
        entityType: 'user',
        entityId: user.id,
      });
    });
    await this.sendWithoutDisclosure(
      () => this.email.sendVerificationEmail(user.email!, token),
      'email_verification',
    );
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findFirst({
      where: {
        normalizedEmail: email,
        deletedAt: null,
        status: { not: UserStatus.DEACTIVATED },
      },
      select: { id: true, email: true },
    });
    if (!user?.email) return;

    const token = this.createOpaqueToken();
    await this.prisma.$transaction(async (transaction) => {
      await this.createAuthToken(
        transaction,
        user.id,
        AuthTokenPurpose.PASSWORD_RESET,
        this.hashToken(token),
        PASSWORD_RESET_TTL_MS,
      );
      await this.writeAudit(transaction, {
        actorId: user.id,
        action: 'auth.password_reset.requested',
        entityType: 'user',
        entityId: user.id,
      });
    });
    await this.sendWithoutDisclosure(
      () => this.email.sendPasswordResetEmail(user.email!, token),
      'password_reset',
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.prisma.authToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: { id: true, userId: true, purpose: true, expiresAt: true, consumedAt: true },
    });
    const now = new Date();
    if (
      !stored ||
      stored.purpose !== AuthTokenPurpose.PASSWORD_RESET ||
      stored.consumedAt ||
      stored.expiresAt <= now
    ) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.authToken.updateMany({
        where: {
          id: stored.id,
          purpose: AuthTokenPurpose.PASSWORD_RESET,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException(
          'Invalid or expired password reset token.',
        );
      }
      await transaction.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      });
      await this.revokeAllInTransaction(transaction, stored.userId);
      await this.writeAudit(transaction, {
        actorId: stored.userId,
        action: 'auth.password_reset.completed',
        entityType: 'user',
        entityId: stored.userId,
      });
    });
  }

  async changePassword(
    principal: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
      select: { passwordHash: true },
    });
    if (
      !user?.passwordHash ||
      !(await this.passwords.verify(user.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (await this.passwords.verify(user.passwordHash, newPassword)) {
      throw new ConflictException('The new password must be different.');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: principal.id },
        data: { passwordHash },
      });
      await this.revokeAllInTransaction(
        transaction,
        principal.id,
      );
      await this.writeAudit(transaction, {
        actorId: principal.id,
        action: 'auth.password.changed',
        entityType: 'user',
        entityId: principal.id,
      });
    });
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    await this.revokeSessionFamily(
      principal.sessionId,
      principal.id,
      'auth.logout',
    );
  }

  async logoutAll(principal: AuthPrincipal): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.revokeAllInTransaction(
        transaction,
        principal.id,
      );
      await this.writeAudit(transaction, {
        actorId: principal.id,
        action: 'auth.logout_all',
        entityType: 'user',
        entityId: principal.id,
      });
    });
  }

  async listSessions(principal: AuthPrincipal): Promise<SafeSession[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId: principal.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceName: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === principal.sessionId,
    }));
  }

  async revokeSession(
    principal: AuthPrincipal,
    sessionId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.userSession.updateMany({
        where: {
          id: sessionId,
          userId: principal.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) {
        throw new NotFoundException('Session not found.');
      }
      await transaction.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.writeAudit(transaction, {
        actorId: principal.id,
        action: 'auth.session.revoked',
        entityType: 'user_session',
        entityId: sessionId,
      });
    });
  }

  private async createAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      algorithm: 'HS256',
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      subject: userId,
    };
    const issuer = this.config.get<string>('JWT_ISSUER');
    const audience = this.config.get<string>('JWT_AUDIENCE');
    if (issuer) options.issuer = issuer;
    if (audience) options.audience = audience;
    return this.jwt.signAsync({ sessionId, tokenUse: 'access' }, options);
  }

  private async createAuthToken(
    transaction: Prisma.TransactionClient,
    userId: string,
    purpose: AuthTokenPurpose,
    tokenHash: string,
    ttlMs: number,
  ): Promise<void> {
    const now = new Date();
    await transaction.authToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await transaction.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash,
        expiresAt: new Date(now.getTime() + ttlMs),
      },
    });
  }

  private async sendRegistrationVerification(
    email: string,
    token: string,
  ): Promise<EmailDeliveryStatus> {
    try {
      return await this.email.sendVerificationEmail(email, token);
    } catch (error) {
      this.logger.error({
        message: 'Registration verification email delivery failed.',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new ServiceUnavailableException(
        'Registration was saved, but verification email delivery is unavailable. Request another verification email.',
      );
    }
  }

  private async sendWithoutDisclosure(
    send: () => Promise<EmailDeliveryStatus>,
    purpose: 'email_verification' | 'password_reset',
  ): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.error({
        message: 'Authentication email delivery failed.',
        purpose,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async verifyUnknownAccount(password: string): Promise<boolean> {
    await this.passwords.burnForUnknownAccount(password);
    return false;
  }

  private async writeFailedLogin(
    userId: string | undefined,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: userId,
        metadata: {
          reason: 'invalid_credentials',
          ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        },
      },
    });
  }

  private async writeAudit(
    transaction: Prisma.TransactionClient,
    input: {
      actorId?: string;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: RequestMetadata | Record<string, string | undefined>;
    },
  ): Promise<void> {
    await transaction.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: this.auditMetadata(input.metadata),
      },
    });
  }

  private auditMetadata(
    metadata?: RequestMetadata | Record<string, string | undefined>,
  ): Prisma.InputJsonObject {
    const entries = Object.entries(metadata ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    return Object.fromEntries(entries);
  }

  private async revokeSessionFamily(
    sessionId: string,
    userId: string,
    action: string,
  ): Promise<void> {
    await this.prisma.$transaction((transaction) =>
      this.revokeSessionInTransaction(
        transaction,
        sessionId,
        userId,
        action,
      ),
    );
  }

  private async revokeSessionInTransaction(
    transaction: Prisma.TransactionClient,
    sessionId: string,
    userId: string,
    action: string,
  ): Promise<void> {
    const now = new Date();
    await transaction.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await transaction.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    await this.writeAudit(transaction, {
      actorId: userId,
      action,
      entityType: 'user_session',
      entityId: sessionId,
    });
  }

  private async revokeAllInTransaction(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const now = new Date();
    await transaction.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await transaction.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private createOpaqueToken(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    )
      .update(token, 'utf8')
      .digest('hex');
  }

  private equalTokenHashes(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left, 'utf8');
    const rightBytes = Buffer.from(right, 'utf8');
    return (
      leftBytes.length === rightBytes.length &&
      timingSafeEqual(leftBytes, rightBytes)
    );
  }

  private refreshExpiry(from: Date): Date {
    const days = this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private limitUserAgent(userAgent?: string): string | undefined {
    return userAgent?.slice(0, 512);
  }

  private throwRegistrationConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Unable to register with the provided details.',
      );
    }
    throw error;
  }
}

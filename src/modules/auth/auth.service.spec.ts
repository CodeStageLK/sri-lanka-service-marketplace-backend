import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthTokenPurpose, Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import {
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { PasswordService } from './password.service';

describe('AuthService', () => {
  let service: AuthService;
  let transaction: {
    role: { findUnique: jest.Mock };
    user: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    userSession: { create: jest.Mock; updateMany: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    authToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    user: { findFirst: jest.Mock; findUnique: jest.Mock };
    refreshToken: { findUnique: jest.Mock };
    authToken: { findUnique: jest.Mock };
    userSession: { findMany: jest.Mock; findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let email: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };
  let passwords: {
    hash: jest.Mock;
    verify: jest.Mock;
    burnForUnknownAccount: jest.Mock;
  };
  let config: { get: jest.Mock; getOrThrow: jest.Mock };

  beforeEach(async () => {
    transaction = {
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-id' }) },
      user: {
        create: jest.fn().mockResolvedValue({ id: 'user-id', email: 'user@example.com' }),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      userSession: {
        create: jest.fn().mockResolvedValue({ id: 'session-id' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      authToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn(
        (work: (tx: typeof transaction) => Promise<unknown>) =>
          work(transaction),
      ),
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      refreshToken: { findUnique: jest.fn() },
      authToken: { findUnique: jest.fn() },
      userSession: { findMany: jest.fn(), findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    email = {
      sendVerificationEmail: jest.fn().mockResolvedValue('accepted'),
      sendPasswordResetEmail: jest.fn().mockResolvedValue('accepted'),
    };
    passwords = {
      hash: jest.fn().mockResolvedValue('$argon2id$test-hash'),
      verify: jest.fn().mockResolvedValue(true),
      burnForUnknownAccount: jest.fn(),
    };
    config = {
      get: jest.fn().mockReturnValue(undefined),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          JWT_REFRESH_SECRET: 'refresh-secret-for-tests-at-least-32-chars',
          JWT_ACCESS_SECRET: 'access-secret-for-tests-at-least-32-chars',
          JWT_ACCESS_TTL_SECONDS: 900,
          JWT_REFRESH_TTL_DAYS: 30,
        };
        return values[key];
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: EmailService, useValue: email },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('access-jwt') } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('creates a customer profile and grants only the seeded customer role', async () => {
    const result = await service.registerCustomer(
      {
        firstName: 'Nimal',
        lastName: 'Perera',
        email: 'USER@EXAMPLE.COM',
        password: 'a secure password 123',
      },
      {},
    );

    const data = transaction.user.create.mock.calls[0][0].data;
    expect(data.normalizedEmail).toBe('user@example.com');
    expect(data.customerProfile.create).toMatchObject({
      firstName: 'Nimal',
      lastName: 'Perera',
    });
    expect(data.roles.create.role.connect.id).toBe('role-id');
    expect(data.passwordHash).toBe('$argon2id$test-hash');
    expect(result.emailDelivery).toBe('accepted');
  });

  it('keeps individual provider registration unverified', async () => {
    await service.registerIndividualProvider(
      {
        displayName: 'Nimal Perera',
        email: 'provider@example.com',
        password: 'a secure password 123',
      },
      {},
    );

    const data = transaction.user.create.mock.calls[0][0].data;
    expect(data.providerProfile.create.providerType).toBe('INDIVIDUAL');
    expect(data.providerProfile.create.verificationStatus).toBeUndefined();
    expect(data.roles.create.role.connect.id).toBe('role-id');
  });

  it('creates business details without approving provider verification', async () => {
    await service.registerBusinessProvider(
      {
        businessName: 'Colombo Services',
        email: 'business@example.com',
        password: 'a secure password 123',
      },
      {},
    );

    const profile = transaction.user.create.mock.calls[0][0].data.providerProfile.create;
    expect(profile.providerType).toBe('BUSINESS');
    expect(profile.businessDetails.create.businessName).toBe('Colombo Services');
    expect(profile.verificationStatus).toBeUndefined();
  });

  it('does not send a verification email when registration rolls back on duplicate email', async () => {
    transaction.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.registerCustomer(
        {
          firstName: 'Nimal',
          lastName: 'Perera',
          email: 'user@example.com',
          password: 'a secure password 123',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('creates a device session for an active account with a valid password', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-id',
      passwordHash: '$argon2id$stored-hash',
      status: 'ACTIVE',
      isEmailVerified: true,
    });

    const result = await service.login(
      'user@example.com',
      'correct password',
      { ipAddress: '127.0.0.1' },
      'MOBILE',
      'Nimal\'s phone',
    );
    const sessionData = transaction.userSession.create.mock.calls[0][0].data;
    expect(sessionData.deviceName).toBe('Nimal\'s phone');
    expect(sessionData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(transaction.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'session-id' }),
      }),
    );
    expect(result.clientType).toBe('MOBILE');
  });

  it('uses the same credential error for missing accounts and does dummy hash work', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login('missing@example.com', 'wrong password', {}, 'MOBILE'),
    ).rejects.toThrow('Invalid email or password.');
    expect(passwords.burnForUnknownAccount).toHaveBeenCalledWith(
      'wrong password',
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login.failed' }),
      }),
    );
  });

  it('rejects suspended accounts even when their password is valid', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-id',
      passwordHash: '$argon2id$stored-hash',
      status: 'SUSPENDED',
      isEmailVerified: true,
    });

    await expect(
      service.login('user@example.com', 'correct password', {}, 'MOBILE'),
    ).rejects.toThrow('Invalid email or password.');
    expect(transaction.userSession.create).not.toHaveBeenCalled();
  });

  it('rotates a refresh token and persists only its HMAC hash', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      sessionId: 'session-id',
      expiresAt,
      revokedAt: null,
      session: {
        revokedAt: null,
        expiresAt,
        tokenHash: createHmac(
          'sha256',
          'refresh-secret-for-tests-at-least-32-chars',
        )
          .update('old-refresh-token')
          .digest('hex'),
      },
      user: {
        status: 'ACTIVE',
        isEmailVerified: true,
        deletedAt: null,
      },
    });

    const pair = await service.refresh('old-refresh-token', {});
    const createdToken = transaction.refreshToken.create.mock.calls[0][0].data;
    expect(pair.refreshToken).not.toBe('old-refresh-token');
    expect(createdToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdToken.tokenHash).not.toBe(pair.refreshToken);
    expect(createdToken.sessionId).toBe('session-id');
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'token-id', revokedAt: null }),
      }),
    );
    expect(pair.refreshExpiresAt).toEqual(expiresAt);
  });

  it('revokes a token family when a rotated refresh token is reused', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'old-token-id',
      userId: 'user-id',
      sessionId: 'session-id',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      session: {
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        tokenHash: createHmac(
          'sha256',
          'refresh-secret-for-tests-at-least-32-chars',
        )
          .update('replayed-token')
          .digest('hex'),
      },
      user: { status: 'ACTIVE', isEmailVerified: true, deletedAt: null },
    });

    await expect(service.refresh('replayed-token', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(transaction.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-id', userId: 'user-id', revokedAt: null },
      }),
    );
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'session-id', revokedAt: null },
      }),
    );
  });

  it('rejects expired or already-consumed email verification tokens', async () => {
    prisma.authToken.findUnique.mockResolvedValue({
      id: 'auth-token-id',
      userId: 'user-id',
      purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() - 1),
      consumedAt: null,
    });

    await expect(service.verifyEmail('expired-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks a valid email verification token as used and activates a pending user', async () => {
    prisma.authToken.findUnique.mockResolvedValue({
      id: 'auth-token-id',
      userId: 'user-id',
      purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });

    await service.verifyEmail('valid-token');
    expect(transaction.authToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'auth-token-id',
          consumedAt: null,
        }),
      }),
    );
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isEmailVerified: true },
      }),
    );
    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-id', status: 'PENDING' },
        data: { status: 'ACTIVE' },
      }),
    );
  });

  it('rejects expired password reset tokens before changing credentials', async () => {
    prisma.authToken.findUnique.mockResolvedValue({
      id: 'reset-token-id',
      userId: 'user-id',
      purpose: AuthTokenPurpose.PASSWORD_RESET,
      expiresAt: new Date(Date.now() - 1),
      consumedAt: null,
    });

    await expect(
      service.resetPassword('expired-token', 'new password 123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwords.hash).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes session revocation to the authenticated user', async () => {
    transaction.userSession.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.revokeSession(
        {
          id: 'user-id',
          email: 'user@example.com',
          isEmailVerified: true,
          sessionId: 'current-session',
          roles: ['CUSTOMER'],
          permissions: [],
          customerProfile: null,
          providerProfile: null,
        },
        'another-users-session',
      ),
    ).rejects.toThrow('Session not found.');
    expect(transaction.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'another-users-session',
          userId: 'user-id',
          revokedAt: null,
        },
      }),
    );
  });
});

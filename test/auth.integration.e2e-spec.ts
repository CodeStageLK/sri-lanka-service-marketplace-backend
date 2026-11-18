import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { EmailService } from '../src/modules/auth/email.service';
import { PasswordService } from '../src/modules/auth/password.service';
import type { AccessTokenClaims } from '../src/modules/auth/auth.types';

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
const isolatedBranchName = process.env.AUTH_TEST_DATABASE_CONFIRM;
const describeIfConfigured =
  databaseUrl && isolatedBranchName === 'phase3-schema-test'
    ? describe
    : describe.skip;

describeIfConfigured('AuthService with an isolated Neon branch', () => {
  const emailAddress = `phase4-auth-${randomUUID()}@example.test`;
  let prisma: PrismaClient;
  let auth: AuthService;
  let verificationToken: string | undefined;
  let resetToken: string | undefined;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('AUTH_TEST_DATABASE_URL is required.');
    const testHost = new URL(databaseUrl).hostname;
    const configuredAppUrl = process.env.DATABASE_URL;
    if (
      configuredAppUrl &&
      new URL(configuredAppUrl).hostname === testHost
    ) {
      throw new Error('The auth integration test must not use the app database URL.');
    }

    prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
      transactionOptions: { maxWait: 10_000, timeout: 20_000 },
    });
    const config = new ConfigService({
      JWT_REFRESH_SECRET: 'integration-refresh-secret-at-least-32-chars',
      JWT_ACCESS_SECRET: 'integration-access-secret-at-least-32-chars',
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_TTL_DAYS: 30,
    });
    const email = {
      sendVerificationEmail: jest.fn(
        async (_email: string, token: string) => {
          verificationToken = token;
          return 'accepted' as const;
        },
      ),
      sendPasswordResetEmail: jest.fn(
        async (_email: string, token: string) => {
          resetToken = token;
          return 'accepted' as const;
        },
      ),
    };
    auth = new AuthService(
      prisma as unknown as PrismaService,
      new PasswordService(),
      email as unknown as EmailService,
      new JwtService(),
      config,
    );
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({
      where: { normalizedEmail: emailAddress },
    });
    await prisma.$disconnect();
  });

  it('registers, verifies, logs in, rotates/revokes tokens, and resets passwords', async () => {
    await auth.registerCustomer(
      {
        firstName: 'Integration',
        lastName: 'Test',
        email: emailAddress,
        password: 'integration password 123',
      },
      {},
    );
    expect(verificationToken).toBeDefined();
    await auth.verifyEmail(verificationToken!);
    await expect(auth.verifyEmail(verificationToken!)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const initialLogin = await auth.login(
      emailAddress,
      'integration password 123',
      {},
      'MOBILE',
    );
    const claims = await new JwtService().verifyAsync<AccessTokenClaims>(
      initialLogin.accessToken,
      {
        secret: 'integration-access-secret-at-least-32-chars',
        algorithms: ['HS256'],
      },
    );
    const principal = await auth.authenticateSession(
      claims.sub,
      claims.sessionId,
    );
    expect(principal.roles).toContain('CUSTOMER');

    const rotated = await auth.refresh(initialLogin.refreshToken, {});
    await expect(
      auth.refresh(initialLogin.refreshToken, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.authenticateSession(claims.sub, claims.sessionId),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const activeLogin = await auth.login(
      emailAddress,
      'integration password 123',
      {},
      'MOBILE',
    );
    await auth.requestPasswordReset(emailAddress);
    expect(resetToken).toBeDefined();
    await auth.resetPassword(resetToken!, 'new integration password 456');
    await expect(
      auth.resetPassword(resetToken!, 'another password 789'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.refresh(activeLogin.refreshToken, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.login(emailAddress, 'integration password 123', {}, 'MOBILE'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.login(emailAddress, 'new integration password 456', {}, 'MOBILE'),
    ).resolves.toMatchObject({ clientType: 'MOBILE' });
    expect(rotated.refreshToken).not.toBe(initialLogin.refreshToken);
  }, 90_000);
});

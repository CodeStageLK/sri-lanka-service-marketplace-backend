import type { ProviderType, VerificationStatus } from '@prisma/client';

export interface AuthPrincipal {
  id: string;
  email: string;
  isEmailVerified: boolean;
  sessionId: string;
  roles: string[];
  permissions: string[];
  customerProfile: { firstName: string; lastName: string } | null;
  providerProfile: {
    id: string;
    providerType: ProviderType;
    verificationStatus: VerificationStatus;
    isActive: boolean;
  } | null;
}

export interface AccessTokenClaims {
  sub: string;
  sessionId: string;
  tokenUse: 'access';
}

export type ClientType = 'WEB' | 'MOBILE';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresAt: Date;
}

export interface SafeSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  expiresAt: Date;
  lastSeenAt: Date | null;
  createdAt: Date;
  isCurrent: boolean;
}

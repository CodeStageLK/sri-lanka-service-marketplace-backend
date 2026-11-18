import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permissions } from '../decorators/permissions.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RequiresProviderVerification } from '../decorators/requires-provider-verification.decorator';
import { PermissionsGuard } from './permissions.guard';
import { ProviderVerificationGuard } from './provider-verification.guard';
import { RolesGuard } from './roles.guard';
import type { AuthPrincipal } from '../modules/auth/auth.types';

class TestController {
  @Roles('CUSTOMER')
  @Permissions('bookings.read', 'reviews.create')
  customerAction(): void {}

  @Roles('INDIVIDUAL_PROVIDER')
  providerAction(): void {}

  @RequiresProviderVerification()
  verifiedAction(): void {}
}

const principal: AuthPrincipal = {
  id: 'user-id',
  email: 'user@example.com',
  isEmailVerified: true,
  sessionId: 'session-id',
  roles: ['CUSTOMER'],
  permissions: ['bookings.read', 'reviews.create'],
  customerProfile: { firstName: 'Nimal', lastName: 'Perera' },
  providerProfile: null,
};

function contextFor(
  handler: () => void,
  user?: AuthPrincipal,
): ExecutionContext {
  return {
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getHandler: () => handler,
    getClass: () => TestController,
    switchToRpc: () => ({
      getData: () => undefined,
      getContext: () => undefined,
    }),
    switchToWs: () => ({
      getData: () => undefined,
      getClient: () => undefined,
      getPattern: () => undefined,
    }),
    switchToHttp: () => ({
      getResponse: () => undefined,
      getRequest: () => ({ user }),
    }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('authorization guards', () => {
  const reflector = new Reflector();

  it('grants access only when a required role is present', () => {
    const guard = new RolesGuard(reflector);
    expect(
      guard.canActivate(
        contextFor(TestController.prototype.customerAction, principal),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.providerAction, principal),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires every declared permission', () => {
    const guard = new PermissionsGuard(reflector);
    expect(
      guard.canActivate(
        contextFor(TestController.prototype.customerAction, principal),
      ),
    ).toBe(true);
    const missingPermission = { ...principal, permissions: ['bookings.read'] };
    expect(() =>
      guard.canActivate(
        contextFor(
          TestController.prototype.customerAction,
          missingPermission,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires an approved provider for verification-gated actions', () => {
    const guard = new ProviderVerificationGuard(reflector);
    expect(() =>
      guard.canActivate(
        contextFor(TestController.prototype.verifiedAction, principal),
      ),
    ).toThrow(ForbiddenException);

    const verifiedProvider: AuthPrincipal = {
      ...principal,
      providerProfile: {
        id: 'provider-id',
        providerType: 'INDIVIDUAL',
        verificationStatus: 'APPROVED',
        isActive: true,
      },
    };
    expect(
      guard.canActivate(
        contextFor(TestController.prototype.verifiedAction, verifiedProvider),
      ),
    ).toBe(true);
  });
});

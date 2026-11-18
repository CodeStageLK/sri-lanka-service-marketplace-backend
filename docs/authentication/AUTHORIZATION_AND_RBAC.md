# Authorization and RBAC

## Seeded role and permission source

Authorization reuses the Phase 3 `Role`, `Permission`, `UserRole`, and
`RolePermission` tables. Runtime code never creates roles or grants privileges.
Relevant seeded roles are `CUSTOMER`, `INDIVIDUAL_PROVIDER`,
`BUSINESS_PROVIDER`, `ADMIN`, and `SUPER_ADMIN`. Administrator accounts are
provisioned only through the secure bootstrap/admin process; no public
registration route accepts an administrator role.

The `GET /api/v1/auth/me` response contains the authenticated user's current
role codes and the union of permissions assigned to those roles. Administrators
receive only permission codes actually mapped to their seeded roles.

## Backend enforcement

- `JwtAuthGuard` is registered globally; only routes explicitly marked
  `@Public()` are anonymous.
- `@Roles(...)` and `RolesGuard` require at least one listed role. Provider
  roles are denied when their provider profile is inactive.
- `@Permissions(...)` and `PermissionsGuard` require every listed permission.
- `@RequiresProviderVerification()` and `ProviderVerificationGuard` require a
  live `APPROVED` provider profile status.
- Missing principals and lookup failures do not grant access.

Roles and permissions are loaded from PostgreSQL for each authenticated
request, rather than trusted from caller input or stale JWT claims.

## Object-level ownership

No marketplace resource endpoints are implemented in this phase. Existing
session list/revoke operations explicitly scope by the authenticated `userId`.
When customer or provider resource endpoints are added, their services must
scope lookups in the query itself by the caller's customer/provider profile
and, for business actions, the existing provider/business relationships.
Return `404` for another user's private resource to avoid confirming its
existence. Do not rely on UUID unpredictability, frontend visibility, or a
role check as an ownership check.

## Audit events

Authentication writes events to the existing `AuditLog`, including
registration, login success/failure, email verification, password reset,
password change, refresh, logout, logout-all, and session revocation. Audit
metadata excludes passwords, tokens, and email addresses. SMTP delivery
failures log only the event purpose and error type.

Every future admin mutation and role/permission change must add an audit
record with the actor and affected entity. Do not expose `passwordHash`,
refresh token hashes, or auth-token hashes in API responses.

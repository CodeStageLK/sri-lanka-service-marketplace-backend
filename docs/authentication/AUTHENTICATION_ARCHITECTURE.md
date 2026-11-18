# Authentication Architecture

## Scope and identity

Authentication is implemented in this NestJS API using the existing Prisma
`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `CustomerProfile`,
`ProviderProfile`, `ProviderBusinessDetails`, `RefreshToken`, `UserSession`,
and `AuditLog` models. The API remains the identity and authorization
authority; no frontend or Neon-managed identity service is required.

Public registration supports customers, individual providers, and business
providers. The public DTOs cannot choose a role. Each workflow connects only
the corresponding seeded role and creates the related profile in one Prisma
transaction. Business registration creates `ProviderBusinessDetails`.
Providers start with `NOT_SUBMITTED` verification and are never approved by
registration. Accounts start as `PENDING` and become `ACTIVE` after successful
email verification. Suspended and deactivated accounts are not authenticated.
There is no public administrator registration endpoint.

The Phase 3 seed owns role and permission data. Bootstrap administrators only
through the existing seed process using an Argon2id password hash, or through a
separately authenticated administrative process.

## Request path

1. The global throttle guard applies request limits.
2. The global JWT guard authenticates every route unless it has `@Public()`.
3. The access token is verified with the pinned `HS256` algorithm, expiration,
   and configured issuer/audience checks.
4. The guard checks the live `UserSession` and user status in PostgreSQL, then
   loads the user's role and permission grants and profile state.
5. Global role, permission, and provider-verification guards enforce route
   metadata. Missing or insufficient identity is denied.
6. Services scope private records by the authenticated user/profile ID; a
   role or valid token is not ownership authorization.

The principal contains the current union of permissions from all assigned
roles. Role and permission changes therefore take effect on the next request;
they are not trusted from client input or JWT claims.

## Registration transactions

Every registration transaction creates:

- the user with a normalized unique email, Argon2id password hash, and
  `PENDING` status;
- the corresponding customer or provider profile (and business detail record
  for business providers);
- a connection to the already-seeded role; and
- an expiring email-verification token hash and an audit record.

Email delivery runs after the transaction commits. If SMTP fails, registration
remains persisted and the API returns `503`; clients can use the resend
endpoint. In development without SMTP, the development adapter logs that no
message was delivered and registration reports `emailDelivery:
"not_configured"` rather than claiming delivery.

## Email delivery

SMTP is the production adapter. `NODE_ENV=production` requires SMTP settings
and `AUTH_APP_URL` at startup. Locally, SMTP can be omitted; the development
adapter does not send or log token-bearing messages. Tests can inject a
capturing adapter. A provider's SMTP acceptance is reported as `accepted`,
not as proof that the message reached an inbox.

## Resource ownership boundary

This phase adds no marketplace transaction or customer/provider data
controllers. Session operations are scoped to the current user. Future
customer/provider services must constrain database queries by
`customerProfile.userId` or `providerProfile.userId`, enforce business
membership through the existing relationships, and return 404 for another
user's private resources. Adding a role decorator alone is not sufficient.

## Operational constraints

The existing Nest throttler uses process-local storage. The configured
per-route limits protect a single instance; multi-instance deployments must
also enforce shared per-IP limits at the gateway or configure a shared
throttler store. Email delivery and authentication must run behind TLS, and
production environment values must be provisioned outside source control.

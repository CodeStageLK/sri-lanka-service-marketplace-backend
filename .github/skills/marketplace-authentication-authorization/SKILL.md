---
name: marketplace-authentication-authorization
description: "Authentication and authorization design for the Sri Lanka Service Marketplace: one account with CUSTOMER/PROVIDER/ADMIN role grants, JWT access+refresh lifecycle with rotation and device sessions, active-role switching, RBAC plus object-level ownership checks, verification gates on provider actions, and admin privilege separation with audit logging. Use when implementing login, token refresh, role switching, guards, permission checks, session management, or admin access control."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Authentication and Authorization

## Purpose

Specify how one user account safely serves multiple roles (CUSTOMER + PROVIDER, plus web-only ADMIN) across three web apps and a Flutter app, using JWT access+refresh tokens, RBAC, object-level ownership checks, and verification-status gates — all enforced in the NestJS backend, never in clients.

## When to Use

- Implementing or changing login, registration, token refresh, logout, or password flows.
- Writing NestJS guards, decorators, or policies for any endpoint.
- Implementing role switching in the web portal or the Flutter app.
- Gating provider actions on verification status.
- Building admin access, sub-roles, or audit logging of privileged actions.

## One Account, Multiple Roles

- A single `users` row may hold role grants: `CUSTOMER`, `PROVIDER`, `ADMIN`. Customer+provider coexist on one account; users switch experiences without re-registering.
- Registration creates a CUSTOMER grant by default (ASSUMPTION). "Become a provider" adds the PROVIDER grant plus a ProviderProfile — never a second account. Merging duplicate accounts is out of scope at launch (ASSUMPTION).
- ADMIN is granted only by existing admins through the admin dashboard, web-only; admin accounts should not hold marketplace roles in production (ASSUMPTION: separation recommended, confirm policy).
- Admin sub-roles (ASSUMPTION — inferred set, confirm with product): `SUPER_ADMIN`, `VERIFICATION_OFFICER`, `DISPUTE_OFFICER`, `CONTENT_MODERATOR`, `FINANCE_ADMIN`, `ANALYST`.

## JWT Access + Refresh Lifecycle

- **Access token**: short-lived (15 min — ASSUMPTION), signed JWT. Claims: `sub` (user id), `roles` (granted roles), `activeRole`, `providerProfileId` (if any), `verificationStatus` (if provider), `sessionId`, `iat`/`exp`.
- **Refresh token**: long-lived (30 days — ASSUMPTION), opaque, stored server-side (hashed) in Redis/Postgres keyed by `sessionId`.
- **Rotation**: every refresh issues a new refresh token and invalidates the old one. Reuse of a rotated token signals theft → revoke the whole session family.
- **Revocation**: logout, password change, admin suspension, and role revocation kill sessions server-side via the session store; access tokens expire naturally within their short TTL (ASSUMPTION: no per-request blocklist at launch, acceptable with 15-min TTL — revisit for admin tokens).
- **Device sessions (mobile)**: each login creates a session record (device name, platform, FCM token link, last-seen). Users can list and revoke sessions; Flutter stores tokens in `flutter_secure_storage`; web apps keep refresh tokens in httpOnly cookies (ASSUMPTION) and access tokens in memory only.

## Active Role and Role Switching

DECISION (recommended): **`activeRole` as a JWT claim**, switched via `POST /api/v1/auth/switch-role` which issues a fresh access token (refresh token unchanged, same session).

- Rationale: the claim travels with every request with no extra header for clients to forget; switching is an explicit, auditable event; token reissue is cheap with 15-min TTLs. The alternative (per-request `X-Active-Role` header) spreads trust decisions across clients and complicates caching/guards.
- Backend guards still verify the user actually holds the requested role grant — the claim is a routing hint, not the source of truth.
- Clients: web portal flips between customer dashboard and provider portal on switch; Flutter switches navigation shells via Riverpod state after receiving the new token.
- Some endpoints are role-agnostic (profile, notifications); guards specify required role(s) explicitly rather than trusting activeRole blindly.

## RBAC + Object-Level Ownership

Two layers, both mandatory:

1. **Role guard** (coarse): endpoint declares required role(s) — e.g., `@Roles('PROVIDER')` on quotation submission, `@Roles('ADMIN')` + sub-role policy on `/admin/*`.
2. **Ownership/policy check** (fine, object-level): fetch the resource and verify the relationship before acting:
   - Customers read/update only their own enquiries, bookings, payments, reviews, disputes.
   - Providers read enquiries only when open and matching their category + coverage area (lead visibility — ASSUMPTION on matching rule, see `provider-management-workflows`), and only their own quotations/bookings.
   - A user with both roles never sees "both sides" of someone else's transaction; checks bind to the specific customer_id/provider_profile_id on the record, not just role.
   - Unowned resources return 404, not 403 (ASSUMPTION: non-disclosure policy, per `marketplace-api-design`).

Never implement authorization in frontends; UI hiding is UX, not security.

## Verification Gates on Provider Actions

Provider capability is gated by `verification_status` (see `provider-verification`):

- `UNVERIFIED` / `PENDING`: can build profile, add draft services; cannot submit quotations and is not publicly listed (ASSUMPTION — confirm exact gate set).
- `VERIFIED`: full provider capabilities + verified badge.
- `REJECTED`: as unverified, with resubmission allowed.
- `SUSPENDED`: all provider actions blocked; existing bookings handled per dispute/admin policy (ASSUMPTION).

Enforce via a `@RequiresVerification()` guard reading current status from the database (not only the token claim, which may be stale) on quote submission and service publishing.

## Guard Composition Pattern (NestJS)

Order guards from cheap to expensive; all are backend-only:

```
JwtAuthGuard            -> validates signature/expiry, loads claims
RolesGuard              -> @Roles('PROVIDER') vs claims.roles (grant check)
ActiveRoleGuard         -> optional: endpoint requires matching activeRole
RequiresVerification    -> live DB read of provider verification_status
OwnershipPolicy         -> per-handler check binding resource to caller
```

- `@Public()` endpoints skip all guards explicitly; absence of a decorator means authenticated-by-default.
- Policies receive `(user, resource)` and return allow/deny; keep them colocated with the owning module so ownership semantics stay near the entity.
- Guards never silently downgrade data; filtering of list results happens in the query layer using the caller's ids (e.g., `WHERE customer_id = :userId`), not by post-filtering in memory.

### Token Refresh Sequence

1. Client calls `POST /auth/refresh` with refresh token (cookie on web, secure storage on mobile).
2. Backend looks up hashed token by `sessionId`; if already rotated → revoke session family, 401.
3. Issue new access token (same claims, fresh exp) + new refresh token; persist new hash, invalidate old.
4. Client replaces stored tokens atomically; concurrent refreshes from one device must be serialized client-side.

## Admin Privilege Separation and Audit

- Every `/admin/*` endpoint requires ADMIN role + a sub-role policy; SUPER_ADMIN manages admin grants.
- All privileged mutations (verification decisions, dispute resolutions, role grants, suspensions, config changes, refunds) write to `audit_logs` with actor, action, entity, before/after.
- ASSUMPTION: shorter access-token TTL and mandatory session listing for admins; MFA for admin accounts is recommended — DECISION PENDING.
- Admin endpoints are rate-limited and should be IP-restrictable per environment (ASSUMPTION).

## Assumptions and Open Questions

- ASSUMPTION: Token TTLs (15 min access / 30 days refresh) and cookie-based web refresh storage — confirm with security review.
- ASSUMPTION: Registration verification channel (email vs +94 SMS OTP vs both) is undecided; design supports both. REQUIRES VERIFICATION: SMS provider availability/cost in Sri Lanka.
- ASSUMPTION: No per-request access-token blocklist at launch.
- DECISION: activeRole-in-token recommended over per-request header — ratify with team.
- DECISION PENDING: MFA for admins; social login (Google/Apple) for customers.
- REQUIRES VERIFICATION: Any Sri Lankan data-protection obligations (e.g., PDPA) affecting session data, consent, or account deletion flows.

## Checklist

- [ ] Endpoint has a role guard and, for resource access, an object-level ownership/policy check.
- [ ] Role switching uses `/auth/switch-role` token reissue; guards re-verify role grants server-side.
- [ ] Refresh tokens rotate on use; reuse detection revokes the session family.
- [ ] Mobile tokens in flutter_secure_storage; web access tokens in memory, refresh in httpOnly cookie.
- [ ] Provider actions gated by live verification status via guard, not stale token claims.
- [ ] Privileged admin actions audit-logged with actor and before/after state.
- [ ] No authorization logic in any frontend; clients only adapt UI to roles/claims.
- [ ] New auth-affecting assumptions are flagged ASSUMPTION; legal items REQUIRES VERIFICATION.

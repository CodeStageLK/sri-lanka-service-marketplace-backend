---
description: 'Authentication and authorization patterns: JWT access/refresh lifecycle with rotation and revocation, session vs token trade-offs, argon2/bcrypt hashing, RBAC and permission design, enforcement points, multi-role accounts, OAuth2 login, and account security. Use when implementing login, JWT refresh tokens, password storage, role or permission checks, guards/middleware auth enforcement, social login, MFA hooks, or account lockout.'
license: MIT
metadata:
    category: backend
    github-path: skills/backend/authentication-authorization
    github-ref: refs/heads/main
    github-repo: https://github.com/CodeStageLK/engineering-agent-skills
    github-tree-sha: 443649bbc5f0941b679faa7a306956836c3f0d3d
    scope: universal
    version: 1.0.0
name: authentication-authorization
---
# Authentication & Authorization

## Purpose
Defines how identity and access control are implemented safely: short-lived access tokens with rotating refresh tokens, correctly hashed credentials, permission-based authorization enforced at well-defined points, and hardened account flows.

## When to Use
- Building login, registration, logout, or token refresh endpoints
- Storing or verifying passwords
- Designing roles, permissions, or multi-role accounts
- Adding guards/middleware for protected routes
- Integrating OAuth2/social login or adding MFA, lockout, or revocation

## Token Lifecycle (JWT Access + Refresh)
- **Access token**: short-lived (5–15 min), stateless JWT. Claims: `sub` (user id), `roles`/`permissions` (or a version pointer), `iat`, `exp`, `jti`. Keep it small; no PII beyond what authorization needs.
- **Refresh token**: long-lived (days–weeks), opaque random string (or JWT), stored server-side **hashed** (treat like a password) with user id, expiry, and family/chain id.
- **Rotation**: every refresh issues a new refresh token and invalidates the old one. Reuse of an already-rotated token = theft signal → revoke the whole token family and force re-login.
- **Revocation**: access tokens can't be individually revoked without state — keep them short and, for high-security actions, check a denylist (`jti`) or a per-user `tokenVersion` claim bumped on logout-all/password change.
- **Storage (browser clients)**: refresh token in an `HttpOnly; Secure; SameSite=Strict` cookie scoped to the refresh path; access token in memory only. Never either token in `localStorage`.
- Sign with strong keys; prefer asymmetric (RS256/EdDSA) when multiple services verify. Always pin accepted algorithms in verification — reject `none` and algorithm confusion.
- Validate `iss`, `aud`, `exp` on every verification, not just the signature.
- Refresh endpoint skeleton with rotation + reuse detection:

```ts
async function refresh(rawToken: string) {
  const stored = await tokens.findByHash(sha256(rawToken));
  if (!stored) throw new AuthenticationError('invalid refresh token');
  if (stored.revokedAt) {
    // Reuse of a rotated token: assume theft, kill the family
    await tokens.revokeFamily(stored.familyId);
    throw new AuthenticationError('token reuse detected');
  }
  if (stored.expiresAt < new Date()) throw new AuthenticationError('expired');
  await tokens.revoke(stored.id);                       // rotate
  const next = await tokens.issue(stored.userId, stored.familyId);
  return { accessToken: signAccess(stored.userId), refreshToken: next.raw };
}
```

## Sessions vs Tokens
- **Server sessions** (cookie + session store): instant revocation, simple, ideal for single first-party web apps. Costs: shared session store, CSRF protection required.
- **JWTs**: stateless verification across services, mobile/third-party clients, horizontal scale without sticky state. Costs: revocation latency, token size, rotation complexity.
- Don't pick JWTs for a monolith with one web client just because they're fashionable — sessions are often simpler and safer there.
- If you use cookies (either model): `HttpOnly`, `Secure`, `SameSite`, and CSRF tokens for state-changing requests when `SameSite` isn't `Strict`.

## Password Handling
- Hash with **argon2id** (preferred) or **bcrypt** (cost ≥ 12). Never MD5/SHA-x, never reversible encryption, never roll your own.

```ts
import argon2 from 'argon2';
const hash = await argon2.hash(password);          // argon2id defaults
const ok = await argon2.verify(user.passwordHash, password);
```

- Enforce min length (≥ 8–12), check against breached-password lists; skip arbitrary composition rules (NIST guidance).
- Login errors are uniform ("invalid credentials") for unknown-email vs wrong-password; equalize timing by hashing a dummy on unknown users.
- Password change/reset: invalidate all refresh tokens/sessions (bump `tokenVersion`). Reset tokens: single-use, short expiry (≤ 1h), stored hashed, and the response never confirms whether the email exists.

## RBAC & Permission Design
- Authorize on **permissions**, not role names: code checks `booking:cancel`, and roles are bundles of permissions. Renaming/adding roles then requires no code changes.
- Keep roles coarse (3–7: e.g., admin, staff, customer, provider) and permissions fine (`resource:action`).
- Always combine with **ownership/tenancy checks**: `order:read` plus "this order belongs to the caller" — RBAC alone is not object-level authorization (prevent IDOR/BOLA).
- Deny by default: a route with no explicit auth metadata is protected, not public. Public routes are explicitly marked.
- Admin-of-everything shortcuts (`if (user.isAdmin) return true`) are acceptable only in one central policy function, never scattered inline.

## Enforcement Points
- Authentication middleware/guard runs first and attaches a verified principal to the request context; handlers never parse tokens themselves.
- Authorization (permission + ownership) runs as a guard/policy layer per route; declare requirements declaratively (decorator/metadata), evaluate centrally.
- Services enforce critical invariants again (defense in depth) when callable from multiple entry points (HTTP, jobs, events).
- Never trust client-supplied identity: user id comes from the verified token, never from body/query (`userId` in a request body is a red flag).

## Multi-Role Accounts & Role Switching
- Model user→roles as many-to-many; a user can be both customer and provider.
- If the UX has an "active role" context, encode it in the token (`activeRole` claim) and re-issue tokens on switch — don't trust a client-sent header for the active role.
- Authorization decisions use the union of permissions or the active role's set — pick one model and document it; mixing both inconsistently causes privilege bugs.
- Role/permission changes take effect at next token refresh at the latest; for immediate demotion, bump the user's `tokenVersion`.

## OAuth2 / Social Login
- Use **Authorization Code + PKCE**; never implicit flow, never handle provider passwords.
- Validate `state` (CSRF) and, for OIDC, verify the ID token (`iss`, `aud`, signature, `nonce`).
- Link by stable provider `sub`, not email alone (emails change/are reused). On email collision with an existing local account, require verification before linking — silent auto-link is an account-takeover vector.
- After the provider callback, issue **your own** access/refresh tokens; never forward provider tokens to your frontend as session credentials.

## Account Security
- **Lockout/throttling**: progressive delays or temporary lock after N failed logins per account *and* per IP; always rate-limit login, refresh, and reset endpoints.
- **MFA hooks**: design login as a two-step pipeline (credentials verified → MFA challenge → tokens issued) even before MFA ships, so TOTP/WebAuthn slot in without rework. MFA secrets encrypted at rest; recovery codes single-use and hashed.
- Notify users on new-device login, password change, and MFA changes.
- Log auth events (login success/failure, refresh reuse, lockouts) with IP/device for audit — never log passwords or tokens.

## Common Mistakes
- Access tokens in `localStorage` → XSS-stealable; memory + HttpOnly refresh cookie.
- Refresh tokens stored in plaintext DB → hash them; treat as credentials.
- No rotation/reuse detection on refresh → stolen token valid for weeks; rotate + family revoke.
- Role string checks sprinkled through services (`user.role === 'admin'`) → central permission policy.
- Permission check without ownership check → IDOR; always scope to owner/tenant.
- Password reset reveals account existence → uniform responses.
- Trusting OAuth email for account linking → link on provider `sub`, verify email collisions.
- Logout that only deletes the client cookie → also revoke the server-side refresh token.
- Verifying JWTs without pinning algorithm and `iss`/`aud` → algorithm confusion/token substitution.

## Checklist
- [ ] Access tokens ≤ 15 min; refresh tokens rotated on every use with reuse detection
- [ ] Refresh tokens stored hashed server-side; revocable per token and per user
- [ ] Browser storage: access in memory, refresh in HttpOnly Secure cookie
- [ ] Passwords hashed with argon2id or bcrypt(≥12); breached-password check on set
- [ ] All protected routes deny-by-default; public routes explicitly marked
- [ ] Authorization = permission check + ownership/tenant check, centralized
- [ ] Identity always derived from verified token, never request payload
- [ ] Role changes/logout-all enforced via tokenVersion or denylist
- [ ] OAuth uses code+PKCE, validates state/nonce, links by provider sub
- [ ] Login/refresh/reset rate-limited; lockout and auth-event audit logging in place

# Session and Token Security

## Passwords

- New passwords must be 12–128 characters; whitespace and printable
  characters are allowed.
- Passwords are hashed with Argon2id (`memoryCost=19456 KiB`, `timeCost=2`,
  `parallelism=1`). Password hashes are never returned.
- Unknown-account login attempts perform dummy Argon2 work and use the same
  credential error as other login failures.
- Password change verifies the current password. Change and reset revoke every
  active session and refresh token.

## Access tokens

- Access tokens use `HS256` with `JWT_ACCESS_SECRET`; algorithm verification
  is explicitly pinned.
- Default lifetime is 900 seconds and the validated maximum is 900 seconds.
- Tokens contain only `sub`, `sessionId`, `tokenUse`, and standard JWT time
  claims. Role/permission claims are resolved live from PostgreSQL.
- If `JWT_ISSUER` and `JWT_AUDIENCE` are configured, both are required and
  validated on every request.
- Each authenticated request also checks the session expiry/revocation and the
  current user status, email verification state, and role grants.

## Refresh tokens and sessions

- Refresh tokens are 256-bit random opaque values, not JWTs.
- Only an HMAC-SHA-256 hash using `JWT_REFRESH_SECRET` is stored in
  `RefreshToken.tokenHash` and `UserSession.tokenHash`.
- Refresh tokens are linked to a session. Each rotation atomically revokes the
  presented token, updates the session's current hash, and creates its
  replacement. The session has an absolute expiry (30 days by default, at most
  90 days); rotation does not extend that absolute lifetime.
- A previously rotated token or a non-current hash revokes the whole session
  family and returns `401`.
- Logout, logout-all, session revocation, password change, and password reset
  revoke server-side sessions and refresh tokens. Access JWTs are rejected on
  their next request because the session is checked in PostgreSQL.
- Session responses contain device, user-agent, IP, and timestamps, never
  token hashes.

### Browser transport

Web login sets the refresh token in an `HttpOnly`, `SameSite=Strict` cookie
scoped to `/api/v1/auth`, with `Secure` enabled in production. Access tokens
are returned in the response and should be held in memory, not local storage.
Cookie-based refresh requires the matching `x-csrf-token` header. After a
browser reload, clients can call `GET /api/v1/auth/csrf` with credentials to
obtain a fresh CSRF value.

### Mobile transport

Mobile login and refresh return the refresh token in the response body. Mobile
clients must store it using platform secure storage and must not persist it in
plain preferences.

## Verification and reset tokens

Email-verification and password-reset tokens use 256-bit random values. Only
their keyed HMAC-SHA-256 hashes are persisted in `AuthToken`. Tokens are
single-use, purpose-bound, and expire after 24 hours (verification) or one
hour (password reset). New requests consume previous outstanding tokens for
the same user and purpose. A partial unique index prevents concurrent active
tokens of the same purpose.

Forgot-password and resend responses are generic. SMTP delivery errors are
reported in server logs without token or payload details; the response never
claims that an email was sent. The reset UI should use a `no-referrer` policy
and avoid third-party resources on token-bearing pages.

## Required environment

| Variable | Requirement |
| --- | --- |
| `JWT_ACCESS_SECRET` | Required, at least 32 characters, independent secret |
| `JWT_REFRESH_SECRET` | Required, at least 32 characters, distinct HMAC key |
| `JWT_ACCESS_TTL_SECONDS` | Optional, 60–900; defaults to 900 |
| `JWT_REFRESH_TTL_DAYS` | Optional, 1–90; defaults to 30 |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Optional, but must be configured together |
| `AUTH_APP_URL` | Required in production and whenever SMTP is configured |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | All required in production; configure only as a complete set |
| `SMTP_SECURE` | Optional; `true` for implicit TLS, otherwise defaults to `false` |

Use a secret manager or deployment environment for real values. The example
environment file contains placeholders only. Changing `JWT_REFRESH_SECRET`
invalidates existing opaque refresh and email tokens.

## Rate limits and deployment

Login/registration: 5 requests/minute per process/IP; email verification:
10/minute; refresh: 10/minute; password reset request and resend: 3/hour;
password reset/change: 5/hour; CSRF token issue: 30/minute. These use the
existing process-local Nest throttler. Multi-instance production deployments
must add a shared throttler store or equivalent gateway limits, especially
for authentication endpoints.

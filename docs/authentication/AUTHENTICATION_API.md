# Authentication API

All paths use the `/api/v1` prefix. Swagger is available at
`/api/v1/docs`. Request bodies reject unknown fields through the global
validation pipe.

## Registration and login

| Method and path | Access | Result |
| --- | --- | --- |
| `POST /auth/register/customer` | Public, 5/minute | `201`; customer profile and `CUSTOMER` role created |
| `POST /auth/register/provider/individual` | Public, 5/minute | `201`; individual profile and role created |
| `POST /auth/register/provider/business` | Public, 5/minute | `201`; business provider profile/details and role created |
| `POST /auth/login` | Public, 5/minute | `200`; access token and web cookie or mobile refresh token |

Customer registration requires `firstName`, `lastName`, `email`, and a
12–128 character `password`. Individual provider registration requires
`displayName`, `email`, and `password`, with optional `contactPhone`. Business
provider registration requires `businessName`, `email`, and `password`, with
optional `contactPersonName`, `registrationNumber`, `businessAddress`, and
`contactPhone`. Registration cannot select roles or verification status.

Login accepts `email`, `password`, and optional `clientType` (`WEB` by
default, or `MOBILE`) and `deviceName`. Login failures use the same
`401 Invalid email or password` response for unknown, unverified, suspended,
and invalid-credential accounts.

Web login returns the access token in the response and sets an HttpOnly
refresh cookie. It also returns a CSRF value for cookie-based refresh. Mobile
login returns the refresh token in the response body; mobile clients must use
platform-secure storage.

## Token and session operations

| Method and path | Access | Result |
| --- | --- | --- |
| `POST /auth/refresh` | Public, 10/minute | `200`; rotates refresh token and issues access token |
| `POST /auth/logout` | Bearer access token | `204`; revokes current session |
| `POST /auth/logout-all` | Bearer access token | `204`; revokes all sessions |
| `GET /auth/me` | Bearer access token | `200`; safe current-user profile, roles, permissions |
| `GET /auth/sessions` | Bearer access token | `200`; active sessions owned by the user |
| `DELETE /auth/sessions/:sessionId` | Bearer access token | `204`; revokes an owned session, `404` otherwise |
| `GET /auth/csrf` | Public, 30/minute | `200`; issues a CSRF cookie and returns its value |

Mobile refresh sends `{ "refreshToken": "..." }`. Web refresh sends the
HttpOnly cookie and the matching `x-csrf-token` header. Missing or mismatched
CSRF values return `403`. A reused or expired refresh token returns `401`;
reuse revokes the token's session family.

## Verification and password recovery

| Method and path | Access | Result |
| --- | --- | --- |
| `POST /auth/email/verify` | Public, 10/minute | `200`; consumes one verification token |
| `POST /auth/email/resend` | Public, 3/hour | `202`; generic response |
| `POST /auth/password/forgot` | Public, 3/hour | `202`; generic response |
| `POST /auth/password/reset` | Public, 5/hour | `204`; consumes token and revokes all sessions |
| `POST /auth/password/change` | Bearer access token, 5/hour | `204`; verifies current password and revokes all sessions |

Verification and reset bodies use `{ "token": "..." }`; reset also requires
`newPassword`. Password change requires `currentPassword` and `newPassword`.
Forgot/resend responses do not disclose whether an email is registered and
do not claim delivery. Email verification tokens expire after 24 hours;
password reset tokens expire after one hour. Both are single-use.

`POST /auth/register/admin` is intentionally not implemented.

## Error behavior

- `400`: invalid DTO, unknown field, or malformed UUID.
- `401`: unauthenticated, invalid credentials, inactive account, or invalid
  token.
- `403`: authenticated but insufficient role/permission, inactive provider,
  unverified provider action, or invalid CSRF check.
- `404`: session absent or does not belong to the authenticated user.
- `409`: registration conflict or unchanged password.
- `429`: configured throttle limit exceeded.
- `503`: registration persisted but configured SMTP delivery failed.


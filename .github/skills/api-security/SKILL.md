---
name: api-security
description: "Hardens HTTP APIs: rate limiting, boundary input validation, mass assignment protection, BOLA/BFLA defenses from the OWASP API Top 10, correct CORS, API keys vs user tokens, webhook signature verification, pagination limits, non-leaky errors, TLS, and security event logging. Use when designing, building, or reviewing REST/GraphQL endpoints, configuring CORS, handling webhooks, issuing API keys, or responding to API abuse or scraping."
license: MIT
metadata:
  category: "security"
  scope: "universal"
  version: "1.0.0"
---

# API Security

## Purpose
APIs are the primary attack surface of modern systems, and the OWASP API Top 10 shows the same holes recur: object-level authorization bypass, mass assignment, unbounded resources, leaky errors, and misconfigured CORS. This skill gives enforceable defaults for every endpoint.

## When to Use
- Creating or reviewing any HTTP/REST/GraphQL endpoint.
- Configuring CORS, rate limits, or gateway policies.
- Receiving webhooks or issuing API keys / machine tokens.
- Designing pagination, filtering, batch, or export endpoints.
- Investigating scraping, enumeration, abuse, or data-leak reports.

## Rate Limiting & Throttling
- Rate-limit **every** public endpoint; apply strict tiers to auth endpoints (login/signup/reset/OTP), search, exports, and anything that sends email/SMS.
- Key limits by user/API key when authenticated, by IP otherwise; combine both for auth endpoints. Use sliding-window or token-bucket (fixed windows allow 2× bursts at boundaries).
- Return `429` with `Retry-After`; include `RateLimit-*` headers so clients can back off.
- Enforce at the edge (gateway/reverse proxy) backed by shared state (e.g., Redis) so limits hold across instances.
- Add cost-based limits for expensive operations (reports, bulk ops, GraphQL query cost) — request count alone doesn't capture resource burn.
- Degrade gracefully when the rate-limit store is unavailable: prefer fail-open for low-risk reads but fail-closed on auth endpoints, and alert either way.

```text
tier examples (tune to traffic):
  POST /login            5/min per IP + 10/hour per account
  POST /password-reset   3/hour per account, 10/hour per IP
  GET  /search           30/min per user
  POST /exports          2/hour per user (async job)
```

## Input Validation at the Boundary
- Validate **every** request part — body, query, path params, headers — against an explicit schema (zod/joi/pydantic/JSON Schema) before any business logic.
- Allowlist, don't blocklist: define exact fields, types, formats, ranges, lengths, enum values. **Reject unknown fields** (`.strict()` / `additionalProperties: false`).
- Enforce payload size limits at the server/gateway (e.g., 1 MB JSON default) and array length caps; reject deeply nested JSON.
- Parse-then-validate IDs: correct type/format before touching the DB (bad UUID → 400, not a DB error).
- Validation failures return 400 with field-level messages that name the field, not internal structures.

## Mass Assignment Protection
- Never bind request bodies directly to ORM models or DB writes. Map through an explicit DTO/allowlist per endpoint.
- Server-controlled fields — `id`, `role`, `isAdmin`, `balance`, `ownerId`, `tenantId`, `verified`, `createdAt` — must be impossible to set from input, not just ignored by convention.

```ts
// BAD: client can send { role: "admin" }
await User.update(req.params.id, req.body);
// GOOD: schema strips/rejects everything not allowlisted
const dto = UpdateProfileSchema.strict().parse(req.body); // { name?, bio? }
await User.update(req.params.id, dto);
```

- Use separate schemas for create vs update vs admin operations — one shared permissive schema is how `role` leaks in.

## BOLA & BFLA (OWASP API #1 and #5)
- **BOLA** (Broken Object Level Authorization): every endpoint taking an object ID must verify the caller's relationship to that object — scope queries by principal/tenant, return 404 for foreign objects. See the `authorization-design` skill for patterns; apply them to every API verb and nested route.
- **BFLA** (Broken Function Level Authorization): admin/privileged endpoints need explicit permission guards — don't rely on them being "unlinked" or on a different port. Attackers enumerate `/admin`, `/internal`, HTTP verbs (`DELETE` on a read route), and legacy API versions (`/v1/` left unguarded).
- Audit the full route table regularly: every route must declare its auth requirement; no implicit-public routes.
- GraphQL: authorize per-field/per-resolver, not just at the query root; disable introspection in production if the schema is sensitive.

## CORS Configured Correctly
- CORS is browser protection for *users*, not server-side access control — never treat it as auth.
- Allowlist exact origins: `Access-Control-Allow-Origin: https://app.example.com`. Never `*` with `Access-Control-Allow-Credentials: true` (browsers block it, and reflecting the request Origin to simulate it is worse — that's an any-origin credential leak).
- Never reflect arbitrary `Origin` values; validate against a static allowlist with exact-match (subdomain-regex bypasses like `evil-app.example.com.attacker.io` are common).
- Limit `Access-Control-Allow-Methods`/`-Headers` to what's used; keep preflight `Max-Age` reasonable (~600s).
- Public, credential-less read-only APIs may use `*` — only when no cookies/auth headers are involved.

## API Keys vs User Tokens
- **User tokens** (sessions/JWTs): represent a human, short-lived, carry user permissions. **API keys**: represent an application/integration, long-lived, scoped to specific capabilities.
- Store API keys **hashed** (SHA-256 is fine — they're high-entropy, unlike passwords); show plaintext once at creation. Use a prefix scheme (`sk_live_...`, with a lookup prefix) for identification and secret scanning.
- Scope keys to least privilege (read-only vs write; per-resource scopes) and support multiple active keys per account for zero-downtime rotation; track last-used for revocation hygiene.
- Keys belong in the `Authorization` header — never in URLs (logged everywhere) or query strings.
- Never ship API keys in browser or mobile clients; anything client-side is public. Client apps use user tokens; servers use keys.

## Webhook Signature Verification
- **Receiving**: verify an HMAC-SHA256 signature over the **raw request body** with a shared secret before parsing. Compare with a constant-time function. Include a timestamp in the signed payload and reject messages older than ~5 minutes (replay defense). Process idempotently by event ID — providers retry.
- Verify before any side effect; an unsigned/invalid webhook gets 401 and no processing.
- **Sending**: sign payloads the same way, include timestamp + unique event ID, document the verification recipe, support secret rotation (dual-secret window).
- Don't rely on IP allowlists alone; don't fetch "the real event" from an attacker-controllable URL in the payload.

## Pagination Limits & Resource Exhaustion
- Every list endpoint paginates with an enforced `limit` cap (e.g., default 20, max 100) — validate server-side; ignore client requests for `limit=100000`.
- Prefer cursor/keyset pagination for large or hot tables; deep `OFFSET` scans are a self-DoS vector.
- Cap filter/search complexity: bound `IN (...)` list sizes, restrict sortable/filterable fields to indexed allowlists.
- Set request timeouts and DB statement timeouts so one pathological query can't pin a worker.
- Batch endpoints cap batch size; exports run async with per-user concurrency limits.

## Error Responses That Don't Leak
- Production errors return a generic message + stable error code + correlation ID; full details (stack traces, SQL, file paths, dependency versions) go only to server logs keyed by that ID.
- Keep 4xx semantics honest but non-revealing: 401 unauthenticated, 403 forbidden-on-known-resource, 404 for not-found *and* not-yours (hide existence).
- Uniform auth errors — don't distinguish "user not found" from "wrong password", or "invalid key" from "revoked key".
- Strip framework fingerprints: default error pages, `X-Powered-By`, verbose validation internals.

## TLS Everywhere & Security Event Logging
- TLS 1.2+ on every hop, including service-to-service and webhook delivery. Redirect HTTP→HTTPS and set HSTS. No mixed-mode "internal traffic is plaintext" exceptions in shared networks.
- Log security events with timestamp, principal, IP, route, outcome: auth failures, 403/404-on-ID bursts (BOLA probing), rate-limit trips, webhook signature failures, API key creation/revocation, admin actions.
- Never log credentials, tokens, full API keys (log the prefix), or sensitive payloads. Alert on thresholds, not just record.

## Common Mistakes
- Validating only the body and trusting query/path params → schema-validate every request part.
- `Model.update(req.body)` binding → mass assignment; use strict per-endpoint DTO allowlists.
- Reflecting the request `Origin` header with credentials allowed → any site can read authenticated responses; static exact-match allowlist only.
- Parsing webhook JSON before verifying the signature → verify HMAC over the raw body first, constant-time, with timestamp check.
- API key in the query string → leaks into logs, history, referrers; `Authorization` header only.
- `limit` accepted unbounded from the client → enforce a server-side max.
- Stack traces in 500 responses → generic message + correlation ID; details in server logs.
- Rate limits only on login → cover search, exports, email/SMS senders, and expensive queries too.
- Guarding `/admin` UI but not the admin API routes → BFLA; every route declares explicit authz.

## Checklist
- [ ] Every endpoint has rate limiting; auth and expensive endpoints have stricter tiers; 429 + Retry-After returned
- [ ] All request parts validated against strict schemas; unknown fields rejected; payload and array sizes capped
- [ ] Writes go through explicit DTO allowlists; `role`/`ownerId`/`tenantId`-class fields cannot be set from input
- [ ] Object-ID endpoints enforce caller-relationship checks (BOLA); full route table has explicit function-level authz (BFLA)
- [ ] CORS uses an exact-match origin allowlist; no `*` or origin-reflection with credentials
- [ ] API keys hashed at rest, prefixed, scoped, rotatable, sent via Authorization header, never in clients or URLs
- [ ] Webhooks verified via constant-time HMAC over raw body with timestamp replay window; processed idempotently
- [ ] List endpoints enforce max page size; cursor pagination for large sets; statement/request timeouts set
- [ ] Errors return generic message + correlation ID; 404 used to hide foreign resources; no stack traces or fingerprints
- [ ] TLS on all hops with HSTS; security events (auth failures, limit trips, signature failures, admin actions) logged and alerted

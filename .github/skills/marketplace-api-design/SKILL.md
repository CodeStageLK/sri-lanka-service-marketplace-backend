---
name: marketplace-api-design
description: "REST API conventions for the Sri Lanka Service Marketplace NestJS backend: /api/v1 versioning, resource naming per module, auth headers, pagination/filter/sort standards, error envelope, role-scoped endpoints, OpenAPI as the shared contract for 3 web apps and the Flutter app, webhooks, and payment idempotency. Use when designing or reviewing endpoints, DTOs, list queries, error responses, Swagger annotations, or client codegen."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace API Design

## Purpose

Keep one coherent REST surface across all backend modules so that the public website, customer/provider web app, admin dashboard, and Flutter mobile app consume a single, predictable, OpenAPI-documented contract. Consistency here is what makes "one backend, four surfaces" workable.

## When to Use

- Adding or modifying any controller, route, DTO, or query parameter.
- Designing list endpoints (providers, services, enquiries, quotations).
- Shaping error responses or validation feedback.
- Exposing the same resource to customer, provider, and admin audiences.
- Integrating payment gateways or outbound webhooks.

## URL Structure and Resource Naming

- Base path: `/api/v1`. Version in the path; bump to `/api/v2` only for breaking changes (field removals, type changes, semantic changes). Additive changes stay in v1.
- Resources: plural kebab-case nouns matching module ownership:
  - `/api/v1/auth/*`, `/api/v1/users`, `/api/v1/providers`, `/api/v1/categories`, `/api/v1/locations`, `/api/v1/services`, `/api/v1/enquiries`, `/api/v1/quotations`, `/api/v1/bookings`, `/api/v1/payments`, `/api/v1/subscriptions`, `/api/v1/reviews`, `/api/v1/disputes`, `/api/v1/notifications`, `/api/v1/advertisements`, `/api/v1/admin/*`
- Nested only one level, and only for true containment: `/enquiries/{id}/quotations` (quotes of an enquiry). Otherwise filter: `/quotations?enquiryId=`.
- State transitions are verbs as sub-resources (POST): `/quotations/{id}/accept`, `/quotations/{id}/withdraw`, `/bookings/{id}/complete`, `/enquiries/{id}/close`. Never transition state via generic PATCH of a `status` field.
- Admin-only views live under `/api/v1/admin/...` (e.g., `/admin/verifications`, `/admin/disputes`) to keep RBAC and Swagger grouping obvious.

## Authentication Headers

- `Authorization: Bearer <access JWT>` on all protected endpoints.
- Refresh via `POST /api/v1/auth/refresh` with the refresh token (see `marketplace-authentication-authorization` for lifecycle and the active-role mechanism).
- Public, unauthenticated endpoints (surface 1): category tree, location tree, provider public profiles, service search. Mark explicitly with `@Public()`-style decorator; default is authenticated.

## Pagination, Filtering, Sorting

Standard for every list endpoint:

- Query params: `page` (1-based), `limit` (default 20, max 100); `sort=<field>:<asc|desc>` (whitelisted fields only); filters as explicit typed params (`categoryId`, `locationId`, `status`, `minRating`, `priceFrom`/`priceTo`, `q` for text search).
- Location filters accept any level of the hierarchy (province, district, DS division) and match descendants.
- Response envelope:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "totalItems": 134, "totalPages": 7 }
}
```

- ASSUMPTION: offset pagination at launch; switch hot feeds (provider enquiry inbox) to cursor pagination if needed, keeping the same envelope with `meta.nextCursor`.

## Error Envelope

All errors (validation, auth, business) share one shape:

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "code": "QUOTATION_ALREADY_ACCEPTED",
  "message": "This enquiry already has an accepted quotation.",
  "details": [{ "field": "amount", "message": "must be a positive LKR amount" }],
  "requestId": "..."
}
```

- `code` is a stable, machine-readable business code — clients branch on `code`, never on `message`. Maintain the code catalog alongside the OpenAPI spec.
- 400 malformed, 401 unauthenticated, 403 unauthorized/role-gated, 404 not found or not visible to caller, 409 concurrency conflicts, 422 business-rule violations, 429 rate limited.
- Messages are English at launch; `code` enables client-side Sinhala/Tamil localization later.

## Role-Scoped Views of Shared Resources

The same resource often has three audiences; keep one URL per audience context, with RBAC + ownership filters applied server-side:

- `/enquiries` — customer: own enquiries. `/providers/me/enquiries` (or `/enquiries?scope=inbox`) — provider: open enquiries matching category + coverage area (lead inbox). `/admin/enquiries` — admin: all, with moderation fields.
- Response DTOs differ per audience (e.g., provider view of an enquiry hides customer contact details until quotation accepted — ASSUMPTION). Define separate DTO classes (`EnquiryCustomerDto`, `EnquiryProviderDto`, `EnquiryAdminDto`); never one DTO with conditionally-null sensitive fields.
- Ownership checks are object-level (see `marketplace-authentication-authorization`): 404 (not 403) for resources the caller shouldn't know exist — ASSUMPTION on disclosure policy.

## OpenAPI as the Shared Contract

- Every endpoint fully decorated: `@ApiTags` per module, `@ApiOperation`, typed request/response DTOs, documented error codes, auth requirements.
- Spec is exported in CI (`/api-json`) and versioned as a build artifact.
- Web apps (surfaces 1–3) generate TS types/clients from the spec; the Flutter app generates Dio clients and Freezed models from the same artifact. Hand-written client models are forbidden — drift between the four surfaces is the top integration risk.
- DTO field naming: camelCase JSON; dates as ISO-8601 UTC strings; money as `{ "amount": "12500.00", "currency": "LKR" }` strings to avoid float loss (ASSUMPTION: string-amount convention).

## Webhooks, Notifications, Idempotency

- Inbound payment gateway webhooks: `POST /api/v1/payments/webhooks/<gateway>` — no JWT; verify gateway signature; respond 2xx fast; process asynchronously; must tolerate duplicate delivery (idempotent by gateway event id). REQUIRES VERIFICATION: gateway choice and its signature scheme.
- Client-initiated payment endpoints require `Idempotency-Key` header (UUID). Store key + response; replay the stored response on retry with the same key. Apply the same to quotation acceptance (`/quotations/{id}/accept`) since it is a money-adjacent, non-repeatable action — ASSUMPTION.
- Device/push registration: `POST /api/v1/notifications/devices` (FCM token, platform); in-app notification feed: `GET /api/v1/notifications` with unread counts.

## Rate Limiting and Caching

- Public discovery endpoints (category tree, location tree, provider search) are cacheable: short-TTL Redis cache server-side + `Cache-Control`/`ETag` headers for surface 1 SEO pages.
- Authenticated endpoints send `Cache-Control: no-store`; clients rely on TanStack Query (web) / Riverpod caching (Flutter) with explicit invalidation on mutations.
- Rate limits per IP on public/auth endpoints and per user on mutation endpoints; 429 responses use the standard error envelope with `retryAfter` detail (ASSUMPTION: limits are config values).

## Assumptions and Open Questions

- ASSUMPTION: Offset pagination default; cursor upgrade path reserved.
- ASSUMPTION: Money serialized as string amounts with explicit currency.
- ASSUMPTION: Provider view hides customer contact details pre-acceptance.
- ASSUMPTION: 404-over-403 disclosure policy for unowned resources.
- DECISION PENDING: codegen toolchain (e.g., openapi-typescript / openapi-generator for Dart) — pick one per platform and standardize.
- REQUIRES VERIFICATION: Payment gateway(s) available for LKR settlement and their webhook/idempotency semantics.

## Checklist

- [ ] Route under `/api/v1`, plural kebab-case, owned by the correct module; admin views under `/admin`.
- [ ] State changes are POST verb sub-resources, not status PATCHes.
- [ ] List endpoint supports `page`/`limit`/`sort` + typed filters and returns the `data`/`meta` envelope.
- [ ] Errors use the standard envelope with a stable `code` added to the catalog.
- [ ] Per-audience DTOs defined; object-level ownership enforced server-side.
- [ ] Full Swagger decorators; spec regenerates cleanly; clients re-codegen without manual edits.
- [ ] Payment and acceptance endpoints honor `Idempotency-Key`; webhooks are signature-verified and duplicate-safe.
- [ ] Dates ISO-8601 UTC; money string + "LKR"; phone +94 format validated.

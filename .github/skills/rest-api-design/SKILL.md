---
name: rest-api-design
description: "REST API design rules: resource modeling, correct HTTP methods and status codes, pagination, filtering, RFC 7807 error shapes, idempotency, and versioning strategy including deprecation policy. Use when designing or reviewing REST endpoints, choosing status codes, adding pagination or filtering, defining error responses, versioning an API (URI vs header), or writing an OpenAPI contract."
license: MIT
metadata:
  category: "backend"
  scope: "universal"
  version: "1.0.0"
---

# REST API Design

## Purpose
Defines how to design predictable, evolvable HTTP APIs: nouns as resources, semantics carried by methods and status codes, consistent pagination and error contracts, idempotent writes, and a deliberate versioning policy.

> Consolidates: also covers api-versioning (no separate `api-versioning` skill exists in this library).

## When to Use
- Designing new endpoints or reviewing an API surface
- Choosing HTTP methods, status codes, or URL structure
- Adding pagination, filtering, sorting, or search
- Standardizing error responses or idempotency for payments/orders
- Planning API versioning, deprecation, or breaking changes

## Resource Modeling & URLs
- URLs are plural nouns identifying resources: `/orders`, `/orders/{orderId}`, `/orders/{orderId}/items`. Verbs live in the HTTP method.
- Nest at most one level deep; beyond that, flatten with query filters: `/comments?postId=123` not `/users/1/posts/2/comments/3`.
- Kebab-case path segments, camelCase (pick one, enforce everywhere) JSON fields, lowercase query params.
- Non-CRUD actions: model as sub-resources or state transitions — `POST /orders/{id}/cancellation` or `POST /orders/{id}/cancel` as a documented exception; never `GET /cancelOrder?id=`.
- IDs in URLs are opaque to clients (UUID/ULID/public id); never expose auto-increment DB ids if enumeration is a risk.
- A resource's representation is stable: same shape from list and detail endpoints (list may be a documented subset).

## Methods & Status Codes
- `GET` safe + cacheable, never mutates. `PUT` full replace, idempotent. `PATCH` partial update. `DELETE` idempotent (second delete → 404 or 204, pick and document). `POST` create/actions, not idempotent by default.
- Status codes that matter — use them precisely:
  - `200` OK with body; `201` Created (+ `Location` header); `202` Accepted (async); `204` No Content (no body, ever)
  - `400` malformed/invalid input; `401` not authenticated; `403` authenticated but forbidden; `404` not found (also for hiding existence); `409` state conflict (duplicate, version clash); `422` semantically invalid (if you distinguish from 400 — document it)
  - `429` rate limited (+ `Retry-After`); `500` unexpected; `503` dependency down (+ `Retry-After`)
- Never return `200` with `{ "success": false }` — the status code is the contract.
- Validation failures list *all* field errors in one response, not first-failure-only.

## Pagination, Filtering, Sorting
- Every collection endpoint is paginated from day one with an enforced max page size (e.g., 100). Unbounded lists are an outage waiting to happen.
- **Cursor pagination** (opaque `cursor` param + `nextCursor` in response) for large/changing datasets, infinite scroll, and anything hot. Stable under inserts, O(1) at any depth.
- **Offset pagination** (`page`/`limit` + `totalCount`) only for small, admin-style datasets where jump-to-page matters. Document that deep offsets are slow and rows can shift.
- Response envelope for lists is consistent API-wide:

```json
{ "data": [...], "pagination": { "nextCursor": "b64...", "limit": 20 } }
```

- Filtering via query params: `?status=active&createdAfter=2024-01-01`. Sorting: `?sort=-createdAt,name` (leading `-` = desc). Whitelist sortable/filterable fields — never pass params straight into queries.
- Reject unknown filter params with 400 rather than silently ignoring them.

## Error Shape (RFC 7807 style)
- One error format for the whole API, based on `application/problem+json`:

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "detail": "2 fields are invalid.",
  "instance": "/orders",
  "errors": [{ "field": "email", "message": "must be a valid email" }],
  "traceId": "abc123"
}
```

- `type` is a stable, documented error identifier clients can branch on — not the human message.
- Include a correlation/trace id so users can report issues you can find in logs.
- Never leak stack traces, SQL, class names, or dependency error messages.

## Idempotency
- All non-idempotent money/state-critical `POST`s accept an `Idempotency-Key` header: store key + request hash + response; replay returns the stored response; same key with different body → `409`/`422`.
- Keys expire (e.g., 24h). Enforce uniqueness at the storage layer (unique index), not in application memory.
- While the original request is still processing, a replay with the same key returns `409` (or waits) — never starts a second execution.
- Scope idempotency keys per client/API key so two tenants can't collide or replay each other's responses.
- `PUT`/`DELETE` must actually be idempotent in implementation, not just by convention — retrying must not create duplicates or double-apply.
- Design retried webhook/event handlers the same way (dedupe by event id).

## HATEOAS Pragmatism
- Full HATEOAS is rarely worth it. Pragmatic subset: include `Location` on 201, pagination links/cursors, and URLs for related resources where clients would otherwise string-build them.
- Don't let hypermedia replace documentation — the OpenAPI spec is the contract clients code against.

## Versioning & Deprecation
- **Don't version until you must.** Additive changes (new optional fields, new endpoints, new enum values clients were told to tolerate) are not breaking. Removing/renaming fields, changing types/semantics, or tightening validation *are* breaking.
- **URI versioning** (`/v1/orders`) — default choice: visible, cache-friendly, trivially routable, easy to run v1/v2 side by side. Version the whole API surface, not individual endpoints.
- **Header versioning** (`Accept: application/vnd.api+json; version=2` or a date header) — choose when URLs must stay stable or you want per-client pinning; costs tooling complexity and cache `Vary` handling.
- Major versions only (`v1`, `v2`) — never `v1.1` in a URI. Minor evolution is additive within a version.
- Deprecation policy: announce with `Deprecation` and `Sunset` headers plus changelog; minimum support window (e.g., 6–12 months); monitor usage of the old version and contact remaining consumers before shutdown.
- New version = migration guide with field-by-field mapping. No undocumented breaking changes, ever.

## OpenAPI as Contract
- Every endpoint, parameter, schema, and error response exists in the OpenAPI document before (or alongside) implementation; review the spec diff in PRs.
- Generate the spec from code annotations or validate code against a handwritten spec — either way, drift between spec and behavior fails CI (contract tests).
- Examples for every schema; mark required vs optional honestly; document enum tolerance expectations.

## Common Mistakes
- Verbs in URLs (`/getUsers`, `/user/create`) → nouns + methods.
- `200` for everything with an in-body status flag → use real status codes.
- Unpaginated collection endpoints → mandatory pagination with max limit.
- Offset pagination on a hot, growing table → cursor pagination.
- Per-endpoint bespoke error formats → single RFC 7807-style shape.
- Retried `POST` creating duplicate orders → `Idempotency-Key` with persisted responses.
- Breaking change shipped as a "patch" within a version → new major version + deprecation headers.
- `404` vs `403` leaking resource existence to unauthorized callers → return `404` consistently for hidden resources.
- Ignoring unknown query params → reject with 400 so client typos surface.

## Checklist
- [ ] URLs are plural nouns, max one nesting level, no verbs
- [ ] Every endpoint's method and status codes match HTTP semantics (201+Location, 204 bodiless, 409 conflicts)
- [ ] All collections paginated with enforced max limit; cursor used for large/hot data
- [ ] Filter/sort fields whitelisted; unknown params rejected
- [ ] Single RFC 7807-style error shape with stable `type` and trace id
- [ ] Idempotency-Key supported on critical POSTs; PUT/DELETE truly idempotent
- [ ] Versioning strategy chosen and documented; only additive changes within a version
- [ ] Deprecations announced via `Deprecation`/`Sunset` headers with a support window
- [ ] OpenAPI spec complete, reviewed in PRs, and drift-checked in CI

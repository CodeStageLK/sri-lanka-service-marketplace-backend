---
name: marketplace-system-architecture
description: "Describes the system architecture of the Sri Lanka Service Marketplace: four frontend surfaces sharing one NestJS modular-monolith backend, module boundaries and entity ownership, inter-module communication, OpenAPI as the shared contract, and infrastructure (PostgreSQL, Redis, S3, FCM). Use when adding modules, deciding where code lives, wiring cross-module flows, planning SEO/SSR for the public site, or setting up environments and infrastructure."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace System Architecture

## Purpose

Define the macro-architecture so every change lands in the right place: which surface renders it, which backend module owns it, how modules talk to each other, and which infrastructure component backs it. The cardinal rule: **all business logic lives in the NestJS backend; frontends never duplicate it.**

## When to Use

- Creating a new backend module or deciding which existing module owns an entity/endpoint.
- Implementing a flow that spans modules (e.g., accepting a quotation touches Quotations, Bookings, Notifications).
- Choosing where UI logic vs business logic belongs.
- Setting up environments, CI, or infrastructure components.
- Deciding rendering strategy for a new page (SEO vs authenticated app).

## The Four Surfaces, One Backend

| # | Surface | Stack | Notes |
|---|---|---|---|
| 1 | Public customer website | React, TypeScript, Vite, Tailwind, shadcn | SEO-critical: landing, categories, locations, provider profiles |
| 2 | Customer dashboard + Provider portal | React, TS, Vite, Tailwind, shadcn, Zustand, TanStack Query, React Hook Form, Zod | One app serving both roles with role switching |
| 3 | Admin dashboard | React, TS, Vite, Tailwind, shadcn, Zustand, TanStack Query | Web-only; admin sub-roles |
| 4 | Mobile app | Flutter/Dart, Riverpod, Dio, GoRouter, Freezed/json_serializable, flutter_secure_storage, FCM, deep links, maps, camera | Serves CUSTOMER and PROVIDER with in-app role switching |

All four consume the same REST API documented via Swagger/OpenAPI. No surface-specific backends; role-scoped responses come from RBAC, not separate services.

### SSR/Prerendering — Surface 1 Only

Surface 1 carries organic acquisition: category pages, location-based landing pages, and provider profiles must be crawlable with correct meta/OG tags. Vite SPA output alone is insufficient for SEO, so surface 1 needs SSR or prerendering (DECISION: choose prerendering/SSG for mostly-static marketing + category/location pages, with SSR or on-demand revalidation for provider profiles; final mechanism is a team decision). Surfaces 2–4 are authenticated apps with no SEO value — plain SPA/mobile is correct there; do not add SSR complexity to them.

## Backend: Modular Monolith (NestJS)

Modules and primary entity ownership:

| Module | Owns |
|---|---|
| Auth | credentials, tokens, sessions, refresh-token store |
| Users | User, role grants, profile basics |
| Providers | ProviderProfile, portfolio, coverage areas, availability |
| Verification | VerificationSubmission, documents metadata, decisions |
| Categories | Category tree |
| Services | Service listings |
| Locations | Province/District/DS Division reference data |
| Enquiries | Enquiry |
| Quotations | Quotation |
| Bookings | Booking |
| Payments | Payment, payment attempts, refunds |
| Subscriptions | Subscription plans, provider subscriptions |
| Commissions | Commission records, rate configuration |
| Advertisements | Ad placements, campaigns |
| Reviews | Review |
| Notifications | notification records, FCM/email/SMS dispatch |
| Disputes | Dispute, resolution records |
| Analytics | aggregated metrics, reporting |
| Administration | admin config, category/location administration actions |
| Audit Logs | immutable audit entries |

Boundary rules:
- A module exposes a public service interface (and events); other modules never import its repositories or touch its tables directly.
- Controllers live in the owning module; cross-module reads go through the owning module's service.
- Shared primitives (money, pagination, error envelope, locale utils) live in a `common`/`shared` library, not in any domain module.

## Inter-Module Communication

DECISION (recommended, confirm with team): hybrid model —
- **Direct service calls** (synchronous, same transaction) for invariant-enforcing operations: e.g., Quotations calls Bookings to create the booking atomically when a quotation is accepted; Payments calls Commissions to compute the platform share.
- **Domain events** (in-process event bus, e.g., Nest `EventEmitter2`) for side effects that must not block or break the core transaction: notifications, analytics counters, audit log entries. Event names: `enquiry.created`, `quotation.submitted`, `quotation.accepted`, `booking.completed`, `payment.succeeded`, `review.published`, `verification.decided`.
- Events are fire-after-commit; handlers must be idempotent. If reliability demands grow, upgrade to a Redis-backed queue (BullMQ) without changing event names.

## Shared API Contract

- Swagger/OpenAPI generated from NestJS decorators is the single contract for all 4 clients.
- Web apps generate typed clients/types from the OpenAPI spec; Flutter generates Dio clients + Freezed models from the same spec.
- Breaking changes require a version bump per `marketplace-api-design` (/api/v1).
- CI should publish the OpenAPI JSON as an artifact so client codegen is reproducible.

## Infrastructure Components

- **PostgreSQL**: single primary datastore; one database, schema-per-nothing (modular monolith shares one schema with module-owned tables).
- **Redis**: caching (category/location trees, provider search results), rate limiting, refresh-token/session state, queues if/when BullMQ is adopted.
- **S3-compatible object storage**: provider portfolio media, verification documents (private bucket + presigned URLs — see `provider-verification`), ad creatives, avatars.
- **FCM**: push notifications to the Flutter app (both roles); web surfaces use in-app + email channels.
- Timezone: store timestamptz UTC; display in Asia/Colombo.

## Frontend State Conventions

- Surfaces 2–3: Zustand for UI/session state, TanStack Query for all server state (no server data in Zustand), React Hook Form + Zod for forms (surface 2).
- Surface 4: Riverpod for state, Dio for HTTP with auth interceptors, GoRouter for navigation/deep links, Freezed/json_serializable for models.
- No surface computes business outcomes (prices, commissions, state legality) locally — display only what the API returns.

## Environment Tiers

- **local** — docker-compose: Postgres, Redis, MinIO (S3-compatible); seeded Sri Lanka location data and sample categories.
- **dev/staging** — shared integration tier; payment providers in sandbox mode; FCM test project.
- **production** — Sri Lanka-serving region; backups, monitoring, log retention.
- ASSUMPTION: exact hosting provider/region is undecided; design for S3-compatible and managed-Postgres portability.

## Assumptions and Open Questions

- ASSUMPTION: Single deployable backend at launch; no microservice extraction planned until scale demands it. Module boundaries are kept clean to preserve that option.
- ASSUMPTION: In-process event bus suffices at launch; Redis-backed queue is the upgrade path.
- DECISION PENDING: SSR vs prerendering mechanism for surface 1 (framework choice, e.g., vite-plugin-ssr/Astro-style prerender vs full SSR host).
- ASSUMPTION: Email/SMS providers for notifications are not yet selected; Notifications module abstracts channels behind interfaces.
- REQUIRES VERIFICATION: Data residency or hosting constraints for Sri Lankan user data, if any.
- REQUIRES VERIFICATION: Payment gateway selection and its integration constraints (affects Payments module and webhooks).

## Checklist

- [ ] New feature's business logic is in a backend module, not a frontend.
- [ ] Entity is owned by exactly one module; cross-module access goes through that module's service, never its tables.
- [ ] Invariant-critical cross-module calls are synchronous/transactional; side effects use after-commit domain events with idempotent handlers.
- [ ] Endpoint added to OpenAPI with accurate DTOs; client types regenerated for web and Flutter.
- [ ] SEO-relevant pages live on surface 1 with prerender/SSR; authenticated features on surfaces 2–4.
- [ ] Redis used for cache/session/rate-limit concerns; S3 for binary media; FCM only via Notifications module.
- [ ] Works across all environment tiers (local docker-compose through production).

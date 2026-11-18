# SERV HUB Architecture

## Independent applications

The parent directory groups four independently installed and deployed projects:

| Project | Role | Local port |
| --- | --- | --- |
| `sri-lanka-service-marketplace` | Customer React/Vite web application | 5173 |
| `sri-lanka-service-marketplace-admin` | Admin React/Vite application | 5174 |
| `sri-lanka-service-marketplace-portal` | Provider React/Vite application | 5175 |
| `sri-lanka-service-marketplace-backend` | NestJS modular-monolith REST API | 3000 |

These are not a monorepo or a pnpm workspace. Each project owns its
dependencies, lockfile, configuration and build. No project imports another
project's source. The existing separate engineering-skills library in the
parent is preserved; it is not an application or workspace configuration.
These cross-project documents live in the backend so the parent needs no
workspace configuration or application source.

## Communication and contracts

Each frontend configures `VITE_API_BASE_URL` and talks to the backend over
HTTP(S), under `/api/v1`. The backend alone owns PostgreSQL access and
business rules. Browser-visible configuration must never contain secrets.
Swagger/OpenAPI (`/api/v1/docs-json`) is the API contract source of truth.
Generate clients independently when the API grows; document contract changes
and coordinate versions. Future shared code must be a versioned package or a
separate repository, not a sibling-source import.

The foundation exposes `GET /api/v1/health` (process liveness),
`GET /api/v1/health/database` (a real query against Neon PostgreSQL) and
`GET /api/v1/health/storage` (a real request against Neon Object Storage);
failed dependencies return HTTP 503. There are no authentication
or business endpoints yet; admin/provider pages are deliberately unprotected
placeholders, not production-ready dashboards.

## Backend boundaries and data

Nest modules will follow business domains; transport, domain logic and
persistence stay separate. Future mobile clients may consume the same
versioned API.

### Neon managed infrastructure

**Neon** (project `royal-sound-58548737`, branch `production`) is the managed
provider for both PostgreSQL and Object Storage. Infrastructure is declared as
code in `neon.ts` (currently the private `assets` bucket) and reconciled with
`neon config plan` / `neon deploy`. Neon writes its variables into the
gitignored `.env.local`; application variables live in `.env`. Do not replace
Neon with a local PostgreSQL container or another provider.

- **PostgreSQL via Prisma** — the application uses the pooled `DATABASE_URL`
  (PgBouncer, transaction mode); Prisma Migrate uses the direct
  `DATABASE_URL_UNPOOLED` through `directUrl`. A global `PrismaModule`
  provides `PrismaService` (connect on module init, disconnect on shutdown via
  Nest shutdown hooks). The schema currently has no business models; entity
  design precedes the Phase 3 domain modules — do not treat planning
  assumptions in the business proposal as validated decisions.
- **Object Storage** — Neon Object Storage is S3-compatible and branch-scoped.
  The global `StorageModule` provides `StorageService`
  (`src/infrastructure/storage`), built on `@aws-sdk/client-s3` with
  path-style addressing and the AWS-standard variables Neon injects. It
  supports upload, download, presigned GET URLs, existence checks, deletion,
  listing and a real connectivity ping, with errors normalized to
  `StorageError`. `StorageFolder` defines the key prefixes for customer and
  provider profile pictures, provider portfolio images, business documents,
  verification documents and service images. Binary content lives only in the
  bucket; PostgreSQL stores object keys and metadata.

### Cross-cutting backend infrastructure

Centralized validated configuration (Joi), global exception filter, global
validation pipe, structured JSON logging, helmet security middleware,
request-id propagation, CORS allow-list, global rate limiting
(`@nestjs/throttler`) and Swagger under `/api/v1/docs`.

## Frontend boundaries

Features own their UI, state and API integrations. Application-level routing,
layouts and generic UI stay within each frontend. TanStack Query is configured
for server state; Zustand is available for client state. Design tokens are
local copies until a separately versioned shared package is explicitly chosen.

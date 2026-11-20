# Implementation Progress

## Phase 5: core marketplace backend services

- Added catalog, location, provider profile/discovery, provider assignment,
  service-request, provider-matching, and enquiry NestJS modules.
- Added public discovery and administrator/provider/customer endpoint groups
  under `/api/v1`, with existing Phase 4 guards and seeded permissions.
- Added forward-only migration
  `20261121000000_phase5_marketplace_services` for provider-service assignments
  and request-service selections. This migration has not been applied to
  production.
- Added marketplace architecture and workflow documentation.
- Verification status: Prisma generation, TypeScript typecheck, and backend build
  are being run; migration deployment remains explicitly unrequested.

### Phase 5 verification (actual results)

- `pnpm run prisma:generate`: passed.
- `pnpm exec dotenv -e .env.local -e .env -- prisma validate`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run lint`: passed.
- `pnpm test -- --runInBand`: 34 tests passed across 7 suites, including the
  new provider matching eligibility unit tests.
- `pnpm run build`: passed.
- No database migration was applied. Migration
  `20261121000000_phase5_marketplace_services` remains ready for isolated
  branch testing and explicit production deployment approval.

## Phase 1: repository foundation

- Four independent application directories, with no parent package manager workspace.
- Customer, admin and provider shells with independent Vite/React configuration.
- NestJS API foundation with validated configuration, Swagger and health endpoint.
- Prisma schema is intentionally empty; no business entities, migrations or seed data.
- Business functionality, authentication and authorization remain future work.

## Phase 2: Neon backend foundation

- Neon CLI (v9.5.1) initialized in the backend: linked to project
  `royal-sound-58548737` (org `org-super-king-10908766`), branch `production`,
  with `postgres` and `object-storage` services declared in `neon.ts`.
- `neon deploy` provisioned the private `assets` bucket and pulled nine
  Neon-managed variables into `.env.local` (Postgres pooled/unpooled URLs,
  branch identifiers, AWS-standard object storage credentials).
- Prisma wired to Neon PostgreSQL: pooled `DATABASE_URL` for application
  traffic, `DATABASE_URL_UNPOOLED` as `directUrl` for migrations. Global
  `PrismaModule`/`PrismaService` with connect/disconnect lifecycle, failure
  logging and graceful shutdown (`enableShutdownHooks`).
- Reusable `StorageService` over Neon Object Storage (S3-compatible,
  `@aws-sdk/client-s3` with `forcePathStyle: true`): upload, download,
  presigned URLs, exists, delete, list, connectivity ping, normalized
  `StorageError` mapping, and `StorageFolder` key prefixes for profile
  pictures, portfolio images, business/verification documents and service
  images. Object bytes are never stored in PostgreSQL.
- Global rate limiting (`@nestjs/throttler`), environment validation extended
  for Neon variables, `.env.local`/`.env` layered configuration.
- Health endpoints under `/api/v1`: `GET /health` (process),
  `GET /health/database` (real `SELECT 1` against Neon),
  `GET /health/storage` (real bucket list operation).
- The Prisma schema intentionally remains without business models; the full
  SERV HUB schema is Phase 3 work.

## Phase 3: initial marketplace database

- Added the initial Prisma domain schema for identity/RBAC, customer and
  provider profiles, catalog and geography, requests/enquiries/quotations/
  bookings, reviews, provider availability, subscriptions/leads/advertising,
  payments/refunds/ledger, notifications, complaints/disputes, audit, settings,
  and storage metadata.
- Added UUID keys, normalized-email uniqueness, relational delete behavior,
  UTC `timestamptz`, decimal currency amounts, foreign-key/search indexes, and
  PostgreSQL enum types for bounded states. Geography is an adjacency-list
  `locations` model; PostGIS was not enabled.
- Added PostgreSQL migration-only checks, partial unique indexes and workflow
  triggers for quotation acceptance, booking consistency, review eligibility,
  address defaults, and input ranges.
- Added an idempotent seed script for roles/permissions, all nine provinces
  and 25 districts, category/service catalog, configurable example plans and
  baseline platform settings. Administrator creation requires environment
  credentials containing a precomputed password hash.
- Added `docs/database/ER_DIAGRAM.md`, `DATABASE_DESIGN.md`,
  `DATABASE_RELATIONSHIPS.md`, `DATABASE_INDEXES.md`, and `SEED_DATA.md`.
- The existing Neon branch was inspected read-only before schema work:
  Prisma migration status reported no migrations, and `prisma db pull
  --print` confirmed the database had no user tables. No data or existing
  migration was overwritten.
- A temporary `phase3-schema-test` branch was used for migration, seed, and
  constraint testing. The backend Neon context was restored to production;
  the isolated test branch has the configured seven-day expiry.
- Created two version-controlled migrations:
  `prisma/migrations/20261118000000_initial_marketplace_schema/migration.sql`
  and `prisma/migrations/20261118040000_uuid_primary_keys/migration.sql`.
  The second migration replaces composite/natural primary keys with UUID
  primary keys while retaining the original pair/key uniqueness. Both
  migrations deployed successfully to an isolated Neon test branch and then
  to production; production migration status is up to date. Production
  Prisma-to-database diff returned an empty migration.
- Production Neon connectivity was verified with a successful query against
  PostgreSQL 18.7. All 53 application tables have UUID primary keys. The
  database contains 88 validated foreign keys, 40 check constraints, 187
  public-schema indexes (including migration metadata), and eight custom
  integrity triggers.
- The seed ran twice successfully on the test branch and twice on production.
  Final production counts: 5 roles, 37 permissions, 109 role-permission
  mappings, 9 provinces, 25 districts, 43 categories, 36 services, 5 plans,
  and 2 baseline settings. The optional initial administrator was not created
  because no secure admin email/hash environment variables were configured.
- Core PostgreSQL invariants were exercised on the isolated branch and passed:
  one accepted quote per request, accepted quote required for a booking, one
  booking and one review per request/booking, and rating bounds. Test fixtures
  were rolled back.
- Prisma schema validation, client generation, TypeScript typecheck, backend
  build, lint, all 13 unit tests, and all 6 API integration tests passed. The
  schema defines 30 PostgreSQL enums.
- Authentication endpoints and marketplace transaction services remain out
  of scope for Phase 3. The quotation-acceptance transaction contract is
  documented for the backend workflow phase; city/town reference rows and an
  administrator account remain to be configured when their data/credentials
  are available.

## Phase 4: authentication and authorization

- Implemented application-managed authentication in the backend, reusing the
  Phase 3 identity, seeded RBAC, profile, session, refresh-token, and audit
  models. No Neon Managed Auth or duplicate identity schema was introduced.
- Added only the missing auth-token table/purpose enum, refresh-token session
  association, and session device name in forward-only migrations
  `20261118070000_auth_session_tokens` and
  `20261118073000_auth_token_single_active`.
- Added customer, individual-provider, and business-provider registration;
  email verification and resend; login; access/refresh token issuance and
  rotation/reuse detection; logout and session listing/revocation; password
  reset/change; and current-user RBAC information. Public administrator
  registration is not available. Provider registration never approves
  verification.
- Authentication is global by default. Access JWTs use pinned HS256 and
  short configurable expiry; each request checks live user/session status and
  loads roles/permissions from the existing database. Existing role,
  permission, and provider-verification guards are wired globally.
- Passwords use Argon2id. Opaque refresh and email tokens are random,
  purpose-bound, expiring, single-use where applicable, and stored only as
  HMAC-SHA-256 hashes. Web refresh uses an HttpOnly SameSite=Strict cookie
  with double-submit CSRF validation; mobile refresh tokens are returned in
  the response for platform-secure storage.
- Added SMTP email delivery and a development adapter that does not log token
  values or claim delivery. Production configuration requires SMTP and
  `AUTH_APP_URL`. Existing Nest throttling is process-local; multi-instance
  production deployments still need a shared throttle store or gateway
  limits.
- Added the auth API, architecture, RBAC, and token-security documentation in
  `docs/authentication/`. Marketplace resource controllers and
  customer/provider object-ownership policies remain future work; no Phase 5
  work was started.
- Applied both auth migrations only to the isolated `phase3-schema-test`
  branch. Prisma reported that branch up to date, and the real Neon auth
  integration flow passed there. Production migration status was checked
  read-only: both auth migrations remain unapplied; no production migration
  was run.

### Phase 4 verification (actual results)

- `pnpm run prisma:generate`, `pnpm run typecheck`, `pnpm run lint`,
  `pnpm run build`: passed.
- `pnpm test -- --runInBand`: 32 tests passed across 6 suites.
- `pnpm run test:e2e`: 11 API tests passed; the gated Neon integration test
  was skipped because credentials are not supplied by default.
- Ran the gated auth integration separately with a direct URL for
  `phase3-schema-test` and the required explicit branch confirmation:
  registration, verification, login, session loading, refresh rotation and
  reuse revocation, password reset and reuse rejection all passed (1 test).
- `pnpm run prisma:migrate:status` against production confirmed four
  migrations are known and the two Phase 4 migrations are pending. Its
  non-zero status is expected while those migrations remain intentionally
  unapplied.

### Phase 2 verification (actual results)

- `neon init` / `neon deploy`: succeeded (bucket `assets` created; env pulled).
  Neon agent-skill installation into local agents was skipped by the CLI
  because it requires Node.js ≥ 22.20 (environment has 22.19.0); the skills
  were read from the installed Neon plugin cache instead.
- Database: real query returned `database=neondb`,
  `server_version=18.7`, over the pooled URL; `prisma migrate dev`/`status`
  connected over the direct (non-pooler) endpoint and reported the schema in
  sync (no models yet, so no migration files were generated — expected).
- Object storage: uploaded `health-checks/verify-<ts>.txt`, verified
  existence, downloaded identical content, deleted it and verified deletion.
  No test objects were left behind. Re-run anytime with `pnpm verify:neon`.
- `pnpm build`, `pnpm lint`, `pnpm test` (13 unit tests, 3 suites): passed.
- Live endpoints returned HTTP 200 with measured round-trip latencies:
  `/api/v1/health`, `/api/v1/health/database` (~815 ms first call),
  `/api/v1/health/storage` (~1.6 s first call), Swagger `/api/v1/docs`.

## Verification (Phase 1)

| Project | Install | Typecheck | Lint | Tests | Build |
| --- | --- | --- | --- | --- | --- |
| Customer | Passed | Passed | Passed | 3 passed | Passed |
| Admin | Passed | Passed | Passed | 3 passed | Passed |
| Provider portal | Passed | Passed | Passed | 3 passed | Passed |
| Backend | Passed | Passed | Passed | 4 unit, 2 HTTP integration tests passed | Passed |

- Each frontend development server returned HTTP 200 on its configured port.
  The integrated browser could not open those frontend ports, so visual browser
  verification remains outstanding.
- The backend started successfully. Health and OpenAPI endpoints returned HTTP
  200; all three configured frontend origins passed the CORS smoke test, and
  an unlisted origin was not allowed. Swagger UI rendered in the browser.
- Prisma schema validation, client generation, and the empty seed command passed
  using a temporary example database URL; no database connection or migration
  was exercised.
- pnpm reported ignored dependency build scripts. Frontend builds and explicit
  Prisma generation nevertheless passed in this environment. Installation also
  reported deprecation warnings for ESLint 9 and `@testing-library/jest-dom`
  6.10.0; review dependency upgrades separately.
- The existing engineering-skills library in the parent directory was
  preserved; it is not an application project.

# SERV HUB Backend

Independent NestJS modular-monolith API foundation. Phase 1 includes
configuration validation, structured logging, security middleware, CORS,
request validation, error handling, Swagger, and a liveness endpoint.
Authentication, authorization, database entities and business workflows are
not implemented.

## Setup

Requires Node.js 22 and pnpm 10. PostgreSQL is required for future database
work; the current liveness endpoint does not connect to it.

```powershell
pnpm install
Copy-Item .env.example .env
# Replace both JWT placeholders with different randomly generated secrets.
pnpm start:dev
```

Configure `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET` and comma-separated `CORS_ORIGINS` in `.env`. Use distinct
random secrets of at least 32 characters and an appropriate PostgreSQL URL.
Secrets must not be committed. All required values are validated on startup.
The local API listens on port 3000 by default in the example configuration.

## API

- `GET /api/v1/health` returns `{"status":"ok"}` when the process responds.
  It is a liveness check, not a database readiness check.
- Swagger UI: `/api/v1/docs`; OpenAPI JSON: `/api/v1/docs-json`.

The OpenAPI document is the contract source of truth. API contract changes
must be documented and clients updated independently.

## Commands

- `pnpm start:dev` — development server
- `pnpm build`, `pnpm start:prod` — production build and start
- `pnpm lint`, `pnpm format`, `pnpm typecheck` — code checks and formatting
- `pnpm test`, `pnpm test:e2e` — unit and HTTP integration tests
- `pnpm prisma:generate`, `pnpm prisma:seed` — Prisma client and seed commands

The Prisma schema is intentionally empty of domain models. No migration or
seed data is applied in Phase 1. See `docs/` for the cross-project architecture
and setup notes. Docker builds independently using the project's lockfile.

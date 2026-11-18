# Development Setup

Use Node.js 22 and pnpm 10. Install, configure, run, test and build each
application from its own directory. Do not install at the parent level.

## Backend

The backend uses **Neon** as its managed PostgreSQL and Object Storage
provider. There is no local PostgreSQL database.

```powershell
cd sri-lanka-service-marketplace-backend
pnpm install
Copy-Item .env.example .env
# In .env: keep only the application variables (NODE_ENV, PORT, STORAGE_BUCKET,
# JWT secrets, CORS_ORIGINS, throttle settings) and replace the example JWT
# secrets with two distinct, random secrets.

# One-time Neon setup (requires a Neon account):
npm i -g neon@latest
neon login
# The project is already linked via the committed-ignored .neon context; if
# missing, re-link with:
# neon init -y --org-id org-super-king-10908766 --project-id royal-sound-58548737 --branch production --services postgres,object-storage

# Provision declared services and pull Neon variables into .env.local:
neon deploy          # or `neon env pull` to only refresh variables

pnpm prisma:generate
pnpm start:dev
```

Configuration is layered: `.env.local` holds the Neon-managed variables
(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, branch ids) and
is rewritten by `neon env pull` / `neon deploy`; `.env` holds application
variables. Both are gitignored — never commit real secrets, and never
hand-edit or invent Neon connection strings.

### Database workflow (Prisma + Neon)

- Application traffic uses the pooled `DATABASE_URL` (PgBouncer, `-pooler`
  host). Migrations automatically use the direct `DATABASE_URL_UNPOOLED` via
  `directUrl` in `prisma/schema.prisma`.
- `pnpm prisma:migrate -- --name <name>` — create/apply a dev migration.
- `pnpm prisma:migrate:deploy` — apply pending migrations (CI/production).
- `pnpm prisma:migrate:status` — inspect migration state.
- `pnpm verify:neon` — real end-to-end connectivity check against Neon
  PostgreSQL and Object Storage (uploads, verifies and deletes a probe object).

### Health and docs

`GET /api/v1/health` (process), `GET /api/v1/health/database` (real Neon
PostgreSQL query) and `GET /api/v1/health/storage` (real Neon Object Storage
request); Swagger is at `/api/v1/docs`. Build with `pnpm build`; use
`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:e2e` for checks.

### Deployment notes

Docker is not required for local development and no PostgreSQL container is
used — Neon is the primary managed database. The NestJS app itself may be
containerized for deployment; supply the same environment variables to the
container (inject them from your deployment platform's secret store, pulled
via `neon env pull` or the Neon console — do not bake them into images).

## Frontends

For each application, change into its own folder, then:

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Configure `VITE_API_BASE_URL` for the backend. Customer uses port 5173, admin
5174 and provider portal 5175; backend uses 3000 in its example. Configure
matching CORS origins when these change. Each frontend supports `pnpm build`,
`pnpm preview`, `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

Authentication is not implemented. Admin and provider dashboard placeholders
must not be treated as secure or deployed as production applications.

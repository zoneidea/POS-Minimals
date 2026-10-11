# POS Minimal

Multi-tenant POS: React Web + Express API + Supabase in one repository.

## Specifications

Read [docs/README.md](docs/README.md), [docs/00_PHASE1_REPOSITORY_SCOPE.md](docs/00_PHASE1_REPOSITORY_SCOPE.md), and [DEVELOPMENT.md](DEVELOPMENT.md) before changing code. Direct user instructions take precedence; frontend/API must deploy together. The two-project topology in the supplied docs is overridden by that instruction.

## Current milestone

Identity/tenant backend slice: `/api/v1/health`, `/api/v1/client/config`, `/api/v1/auth/me`, authenticated `/api/v1/orgs/bootstrap`, user-scoped Supabase adapter, HTTP error envelopes, safe logs, shared OpenAPI types and CI.

Versioned migration creates organizations, memberships, store settings and append-only application activity logs. RLS restricts reads by active membership/role; direct authenticated writes are denied. Bootstrap runs as a narrowly granted DB transaction, verifies email, serializes per user and returns the existing organization on retry.

The React frontend and financial flows are not implemented yet. No migration has been applied to the supplied remote Supabase project. SQL/RLS tests run on isolated PGlite PostgreSQL with an Auth shim; they do not prove hosted Supabase Auth/PostgREST or multi-connection concurrency. See [identity test evidence](docs/20_IDENTITY_IMPLEMENTATION.md).

## Local setup

Requires Node.js 22+ and npm.

```bash
npm ci
npm run contracts:generate
npm run typecheck
npm test
npm run build
npm run dev:api
```

Root `.env.local` provides `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; optional `PORT` and `APP_ALLOWED_ORIGINS` (comma-separated exact origins). See [SUPABASE.md](SUPABASE.md) and `.env.example`. DB credentials must stay server-only. Never commit `.env.local`.

Development API listens on `http://127.0.0.1:8080`. Built server: load root environment variables then `npm run start -w @pos/api`. Local request/response metadata logs are written to `logs/api.jsonl`; headers, bodies, query parameters and tokens are excluded. Production log persistence/retention is not configured yet.

## Repository

Official remote: `https://github.com/zoneidea/POS-Minimals.git`.
Source modules: `apps/api`, reserved `apps/web`, `packages/contracts`.
`contracts/openapi.yaml` is the canonical contract; regenerate types after contract changes. `supabase/migrations` contains the identity migration; `supabase/tests` contains an isolated test-only Auth fixture.

## Database initialization

`DatabaseInitializer` applies pending migrations in order, checks checksums and records history under `private.schema_migrations`. A migration error rolls back that migration; earlier completed migrations remain applied. Run only after confirming a non-production target:

```bash
DB_ENVIRONMENT=development npm run db:migrate
```

The command reads `DATABASE_URL` from the root `.env.local`. Production rollout is a separate reviewed release task. Never run `supabase/tests/auth-fixture.sql` against Supabase: its `auth.*` schema is supplied only by the isolated test harness.

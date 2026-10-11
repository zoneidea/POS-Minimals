# POS Minimal

Multi-tenant POS: React Web + Express API + Supabase in one repository.

## Specifications

Read [docs/README.md](docs/README.md), [docs/00_PHASE1_REPOSITORY_SCOPE.md](docs/00_PHASE1_REPOSITORY_SCOPE.md), and [DEVELOPMENT.md](DEVELOPMENT.md) before changing code. Direct user instructions take precedence; frontend/API must deploy together. The two-project topology in the supplied docs is overridden by that instruction.

## Current milestone

API foundation only: `/api/v1/health`, `/api/v1/client/config`, `/api/v1/auth/me`, authenticated user-scoped Supabase adapter, HTTP error envelopes, safe logs, shared OpenAPI types and CI.

The React frontend and financial flows are not implemented yet. No Supabase migration has been applied. `/auth/me` requires the organization tables and RLS described in the specs. Automated tests inject an identity resolver and do not prove live DB/RLS isolation.

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
`contracts/openapi.yaml` is the canonical contract; regenerate types after contract changes. `supabase/migrations` and `supabase/tests` are reserved for the next identity/tenant slice.

# Identity/tenant backend implementation evidence

Date: 2026-10-11 (Asia/Bangkok)

## Delivered

- Schema: organizations, organization_members, store_settings, activity_logs.
- Read policies: active org + active member; owner-only settings/audit, owner-scoped member list, own-member read for employee/accountant.
- Direct authenticated/anonymous INSERT/UPDATE/DELETE denied on identity tables.
- Narrow bootstrap RPC validates identity/email and serializes provisioning by user; organization/owner/settings/audit are atomic.
- Express bootstrap validates strict DTO and safe errors; no passwords are accepted.
- Initializer executes ordered migrations transactionally, retains SHA-256 history, skips matching applied migrations and rejects checksum drift.

## Checks performed

`npm run contracts:generate`, `npm run typecheck`, `npm test`, `npm run build` passed. Total: 54 tests across three suites.

- HTTP platform: 20 cases; auth/error/CORS/log correlation/tenant-context isolation.
- Bootstrap HTTP: 12 cases; verified service boundary, payload fields, limits, trim and recovery error envelopes.
- PostgreSQL identity/RLS: 22 cases; two orgs, three roles, suspended/anonymous/unverified users, retry behavior, orphan rollback, uniqueness and direct-write denial.

Database checks use [PGlite PostgreSQL](https://pglite.dev/docs/) with a synthetic auth.users/auth.uid shim. Read policy design follows [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Limits and remaining release gates

- Supplied remote Supabase is unchanged; confirm environment before applying migration.
- PGlite has one connection: these checks do not prove multi-connection concurrency/lock waiting on hosted Supabase.
- Auth shim does not verify a real Supabase JWT/email signup, refresh or PostgREST grants. Hosted integration is still required.
- React login/register/onboarding recovery UI and invitations/staff management remain unimplemented.
- Public Auth/provider rate limits and deployment-level durable rate limiting remain release tasks.
- Request/response metadata logs use local JSONL/stdout; database activity logs record successful provisioning. Durable production request-log retention remains pending.
- Roll back application code while preserving additive tables/history; do not delete memberships or audit records as a rollback.

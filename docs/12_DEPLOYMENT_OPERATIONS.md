# 12 — Deployment, Monitoring & Operations

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Environments
- `dev` local + Supabase dev project
- `staging` Vercel preview/staging + Supabase staging project (recommended), seed fake tenants
- `production` Vercel frontend + Vercel Express API + Supabase production project
- Never point staging to production DB; respect Supabase plan capacities and backup features

## 2. Vercel deployment
1. Connect **https://github.com/zoneidea/POS-Minimals.git** to Vercel; configure **two Vercel Projects from the same repository**: Web root `apps/web`, API root `apps/api` (one Express codebase). Use production/staging env targets as appropriate.
2. Express default export at compatible file location (e.g. `src/app.ts`) and ensure API routes resolve
3. Environment vars configured separately for frontend and backend; no service secrets via Vite `VITE_*` env
4. Set Function region near Supabase region; avoid default cross-region latency
5. Configure domains, HTTPS, CORS allowed origins, security headers, error pages, SPA rewrites
6. Deploy preview, run smoke/E2E, promote and monitor

## 3. Environment variable inventory (sample names, **no values**)
| Variable | Frontend | Backend | Comment |
|---|:---:|:---:|---|
| `VITE_API_BASE_URL` | ✓ | | Public API URL |
| `VITE_SUPABASE_URL` | ✓ | | Supabase project URL for auth |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✓ | | Public key only (must pair with secure RLS) |
| `SUPABASE_URL` | | ✓ | Server project URL |
| `SUPABASE_PUBLISHABLE_KEY` | | ✓ | User-scoped data client |
| `SUPABASE_SECRET_KEY` | | admin-only | Isolated invite/bootstrap tasks, never FE |
| `DATABASE_URL` | | optional | Only if direct Postgres connection required; pooler suited to serverless |
| `APP_ALLOWED_ORIGINS` | | ✓ | Strict CORS |
| `LOG_LEVEL` | | ✓ | No password/secret/payment proof logging |
| `CACHE_TTL_SECONDS` | | ✓ | Noncritical local LRU |

## 4. Migrations & backups
- Versioned migrations (`supabase/migrations`), code review before prod
- Never manual edit production schema outside migration history
- Prior to release, verify backup and documented point-in-time recovery support for chosen Supabase plan
- On rollback deploy code safely; for destructive schema changes use expand/migrate/contract and compatible releases; never assume down migration possible
- Test restore quarterly and before major schema update

## 5. Release sequence
- CI typecheck/lint/unit/integration/RLS -> staging migration -> staging deploy -> smoke + UAT + performance -> prod migration -> prod deployment -> smoke/metrics verification
- Smoke: login three roles, POS cash, discount, Excel export, image upload, tenant isolation, void, receipt print dialog

## 6. Observability
- Request IDs per HTTP request; structured logs org ID (nonsecret), actor ID, route, duration, status
- API 5xx, p95 latency, 429s, DB CPU, slow queries, lock contention, 409 cart-stale rate
- Track sale commit, void, stock adjustment and audit reverse as business events without customer secrets
- Alert for checkout error spikes, oversell invariant exception, migration failure, unavailable DB

## 7. Operational response checklist
- Checkout appears timed-out: query sale by same idempotency key before resend
- Printer unavailable: re-open existing sale receipt, do not re-create sale
- DB lock conflict: collect requestId/transaction metrics; bounded safe retry; do not mask stock shortage
- Incorrect product change: owner review audit and reverse if version matches; do not manually alter DB without audit
- Lost account access: use verified Supabase Auth reset flow; do not expose/print current password

## 8. Vendor/documentation links
- Express Vercel https://vercel.com/docs/frameworks/backend/express
- Functions https://vercel.com/docs/functions
- Supabase API Keys https://supabase.com/docs/guides/getting-started/api-keys
- Supabase RLS https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage policies https://supabase.com/docs/guides/storage/security/access-control
- Print dialog API https://developer.mozilla.org/en-US/docs/Web/API/Window/print


## Phase 1 deployed surfaces and future readiness
- Deploy and verify only `apps/web` (React SPA) and `apps/api` (stateless Express); Supabase project managed separately. **Both Vercel Projects use `zoneidea/POS-Minimals` Git repository.**
- Configure stable HTTPS API URL (`VITE_API_BASE_URL`) and exact CORS origin allowlist for Web; API authorization always uses JWT + active org membership + RBAC + RLS.
- Verify production Web signup/login, checkout, receipt printing, exports, imports, 2-org isolation and DB connection/lock monitoring.
- Publish `/api/v1` + OpenAPI to keep future native clients possible, but **do not require JavaFX, Android/iOS installers or smoke tests before Phase 1 go-live**.
- Do not create separate repositories or Express deployments per client platform; scale API instances through Vercel-managed Functions. Connection pooling is managed server-side and is measured under load.

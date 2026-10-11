# DEVELOPMENT_WORKFLOW.md — End-to-End Implementation Workflow

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Phase 0 — Initialize and lock requirements (W1)
1. Read `/docs/README.md`, `13_OPEN_DECISIONS.md`; record approved decision register before implementing financial paths
2. Clone `https://github.com/zoneidea/POS-Minimals.git`; create `apps/web`, `apps/api`, `packages/contracts`, `contracts/openapi.yaml`, `supabase/migrations`, CI workflow (do not create clients/java-sdk or any native/mobile app folder)
3. Configure TypeScript strict, ESLint, Prettier, Vitest, Playwright, unit/integration test harness, dev/staging env
4. Set up Supabase project migrations, safe test data for Org A, Org B and roles
5. Freeze canonical `/api/v1` schema, errors, request IDs, pagination, headers, monetary decimals, Auth bootstrap; retain JavaFX legacy mapping as future reference only; no Java implementation

**Gate:** Both apps run locally, deployment preview reachable, TypeScript/lint/test CI green.

## Phase 1 — Identity & tenant foundation (W1)
1. Supabase Auth login/register/password reset
2. Org provisioning/create owner and store settings, invitation/activation
3. Express auth middleware validates access token -> membership -> role
4. DB RLS/grants and storage policies; verify Org A cannot access Org B
5. FE role-based routes/menus and session-expiry UX

**Gate:** 2-org/3-role matrix tests pass; no unprotected business endpoint.

## Phase 2 — Product & inventory foundations (W2)
1. Category CRUD, unique active name, soft delete
2. Product CRUD + per-org barcode unique inclusive of soft-deleted records
3. Image path/storage, upload validation, numeric default 0
4. Stock movement table, audit before/after and row_version from day one
5. Product listing/filter + stock status + loading/error states

**Gate:** Item create/edit/adjust and role/tenant tests pass.

## Phase 3 — POS checkout slice (W3)
1. Product search+scan, List/Grid, category shortcuts
2. Cart persistence per org+user, mobile flow, discount and VAT calculation UI
3. Cash shortcuts, cash amount/coin validation, PromptPay manual confirmation flow
4. DB transaction/RPC checkout: price snapshot, store snapshot, stock locks, payment and audit
5. Idempotency-key handling, `CART_STALE`, insufficient cash/stock, double click

**Gate:** Cash + PromptPay sale smoke; parallel requests cannot overdraw stock or duplicate sale.

## Phase 4 — Receipts, void and core management (W4)
1. Thermal print-only 80mm receipt from saved snapshots; launch print dialog post-commit
2. OWNER-only void <=24h, stock restoration once, audit and report status
3. Inventory UI/edit/adjust, store settings, categories and tax config
4. Check real printer/browser behavior; clearly document dialog vs silent printing

**Gate:** Successful sale/void/receipt end-to-end, all historic data preserved.

## Phase 5 — Import, audit reverse, reports and dashboard (W5–W6)
1. Excel download template, dry-run import preview/error list, atomic commit
2. Product before/after audit viewer, safe reverse with optimistic version check
3. Snapshot-based sales reports by period+cashier, current-stock and current-cost valuation
4. Excel export with tenant filters and formula escaping
5. Owner-only dashboard with aggregate SQL and caches only for safe metadata

**Gate:** Edited products never rewrite historic sales; report amounts reconcile against sales ledger.

## Phase 6 — Quality and hardening (W7)
1. Full 3-role matrix, 2-org security tests and Storage policy tests
2. E2E UI Light/Dark + phone/tablet/desktop + loading/retry/empty
3. Concurrency checkout/stock/void/idempotency/DB lock order tests
4. Performance test on staging with representative 1k products/50k sales and p95 traces
5. Fix P0/P1, avoid P2 scope creep; review secret leakage and backups

**Gate:** `10_TEST_ACCEPTANCE.md` critical cases all passing; zero P0/P1 issues.

## Phase 7 — Production release (W8)
1. Review migrations, backup/restore procedure, RLS & least-privilege keys
2. Deploy staging -> final UAT by owner, employee, accountant
3. Migrate prod, deploy FE/BE, smoke test, monitor error/latency
4. Document incident guide, rollback, known limitations and version/changelog

**Gate:** Production readiness signoff and acceptance evidence archived.

## Work loop for each ticket
```text
Read spec -> define acceptance + user role + org boundary
  -> design DTO / DB migration / error states
  -> write tests (unit + integration + RLS as needed)
  -> implement backend + FE vertical slice
  -> run checks + 2-org tests + responsive check
  -> review diff/security/concurrency
  -> open PR with screenshots and validation evidence
  -> merge to staging -> smoke -> close ticket
```

## Recommended commands (illustrative; adapt to package manager)
```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

Database:
```bash
supabase db lint
supabase test db
# Migrations are applied through reviewed project-specific scripts and deployment workflow
```

## PR template
```markdown
### Scope / Requirement IDs
### Changed modules + DB migrations
### Org/RBAC/RLS impact
### Checkout / stock / audit impact (if relevant)
### API request-response or UI state changes
### Verification: unit/integration/E2E/security/load
### Screenshots: desktop + mobile + Light/Dark
### Risks / Rollback / Follow-up
```

## Release checklist
- [ ] Migrations reviewed and tested on staging
- [ ] 2-org RLS tests pass, secret key check passes
- [ ] Checkout concurrency and idempotency tests pass
- [ ] Product snapshot/report/void/reverse tests pass
- [ ] Printer 80mm tested, limitation confirmed
- [ ] Excel import/export validates and sanitized
- [ ] Responsive, load indicators, Light/Dark UAT passes
- [ ] Logs, alerts, backup/restore and rollback documented


## Phase 1: Web/API contract-first build/release loop
1. Develop inside the **single GitHub repository** `https://github.com/zoneidea/POS-Minimals.git`; branches/PRs target its default branch (`main`, confirm before pushing).
2. Update `contracts/openapi.yaml` and `07_API_CONTRACT.md` before route/DTO changes, keep `/api/v1` stable.
3. Generate TypeScript API models/client only. Write Express validation, auth, tenant/RBAC middleware and integration tests.
4. Run React Web contract tests, browser CORS cases and raw HTTP calls (including absent `Origin`) to ensure CORS is not authorization.
5. Run parallel Web/HTTP stock checkout and idempotency tests with 2 orgs, and browser responsive/printing UAT.
6. PR includes Web screenshots, CI output, migrations, security notes and real load-test evidence; deploy Vercel Web and API projects from the same GitHub repo.
7. **No JavaFX code, Java model generation, Android/iOS code, native printer adapter or native client build/release gate in Phase 1.**

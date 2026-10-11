# AGENTS.md — POS Minimal Developer / AI Agent Instructions

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Mission
Implement the separate POS Minimal multi-tenant SaaS project according to `/docs/README.md` and linked numbered specs. Do not import features or architecture from the earlier POS Lite project unless explicitly requested.

## Priority of specifications
0. `00_PHASE1_REPOSITORY_SCOPE.md` = **repository + Phase 1 platform scope (highest precedence)**
1. `01_REQUIREMENTS.md` = scope (functions and NFRs)
2. `02_BUSINESS_RULES_WORKFLOWS.md` = calculations/transactions
3. `03_ROLES_PERMISSIONS.md` = RBAC
4. `06_DATABASE_DESIGN.md` & `08_SECURITY_TENANCY.md` = tenant/DB/security
5. `07_API_CONTRACT.md` = HTTP interface
6. `10_TEST_ACCEPTANCE.md` = required proofs
7. `13_OPEN_DECISIONS.md` = documented defaults pending PO approval

If a contradiction appears, **stop implementing the conflicting detail in that task**, document decision in PR, choose the safer default from `13_OPEN_DECISIONS.md`, and update all affected docs/tests together. Do not silently expand scope.

## Mandatory implementation rules
1. Use React + TypeScript + Vite + Tailwind; Node.js + Express + TypeScript; Supabase PostgreSQL/Auth/Storage; Vercel deployable; **Express API v1 must remain extensible for future JavaFX/Mobile, but implement only React Web + Express API + Supabase in Phase 1**.
2. Modular monolith, feature modules isolated; no mega service/controller, no cross-module direct state mutation.
3. Every business row and scoped query has `org_id`; JWT identity + active org membership + role are validated on backend; RLS defense in depth.
4. Never expose Supabase secret/service-role key or DB connection string to frontend; handle Auth via supported flows.
5. Never use Node memory cache for cart, stock, sale/payment, permissions, sessions or idempotency; LRU metadata cache must be tenant-keyed and optional.
6. Sale checkout/void/stock adjustments must be atomic PostgreSQL transactions/RPC with row locking, nonnegative stock, idempotency.
7. Monetary arithmetic must be decimal-safe; all final values recalculated server-side; frontend prices are display only.
8. Sales/store/cashier/product snapshots must be retained; never derive historical price/name from live products.
9. Soft delete mutable master records, never physically delete audit or sale/stock/payment ledgers; reverse always appends new audit/movement event.
10. Receipt output is immutable printer-agnostic JSON; print only after confirmed successful sale commit. Phase 1 implements only Web print dialog/configured kiosk; JavaFX/Mobile print adapters deferred. API never drives local USB printer.
11. Every page fetching data has loading, retry/error, empty, and submission states; responsive Light/Dark supported.
12. Cart persists across reload/route changes and is scoped by user+org; server revalidates at checkout.
13. Numeric input forms initialize with 0; required validations and clear errors.
14. Add integration + RLS + role + cross-org tests for each modified module before marking task done.
15. Do not make invented performance/TPS guarantees; benchmark actual staging with documented data/method.

## Before writing code
- Read README + module spec + related table/API/test sections
- Describe touched files, migration, RBAC and tenant implications, error/loading states, tests
- Create smallest vertical slice with unit+integration test; do not implement unrelated features

## Implementation checklist per pull request
- [ ] Every table/query/export/object is org-scoped
- [ ] API validates JWT/membership/role server-side
- [ ] Inputs use Zod; SQL parameterized; safe amount parsing
- [ ] Transaction/data audit if money, stock, cancellation or reversal touched
- [ ] Concurrency/idempotency tests for changed write paths
- [ ] Historical snapshots not affected by product edits
- [ ] Frontend loading/error/empty/dark/mobile verified
- [ ] Schema migration and rollback compatibility reviewed
- [ ] Tests + docs/contracts updated

## Prohibited shortcuts
- `req.body.org_id` as authorization
- Hardcoding single org or staff rights in client
- Reading DB with privileged client for ordinary user requests while pretending RLS applies
- Calling product UPDATE quantity directly from UI without stock movement
- Logging plaintext passwords, JWTs or Supabase secrets
- Marking PromptPay paid just because QR rendered
- Treating `window.print()` as guaranteed silent printing
- Replaying a failed network POST with a new idempotency key before checking old result


## Phase 1 repository + API-first mandatory instructions
- **Work only in:** `https://github.com/zoneidea/POS-Minimals.git` (`zoneidea/POS-Minimals`). Never invent an alternate repo, split Express projects by client, or copy source into POS Lite repo.
- Initialize monorepo `apps/web`, `apps/api`, `packages/contracts`, `contracts/openapi.yaml`, `supabase/migrations`, `supabase/tests` and `.github/workflows`; use two Vercel Projects from this **same** repo.
- **Web-first absolute scope:** Build React Web UI + Express REST API + Supabase. Do NOT create JavaFX/Java GUI, Java SDK, Android/iOS native app, native printer bridge, native installers, Java CI, or cross-client native UAT as Phase 1 work.
- API remains versioned `/api/v1` and client-neutral; use `07_API_CONTRACT.md`, `contracts/openapi.yaml` and `16_CLIENT_AUTH_LIFECYCLE.md` for Web Auth/Tenant semantics.
- Canonical `/auth/me`, `/orgs/bootstrap`, `/inventory/products`, `/inventory/products/:id/adjust-stock`; older client route mapping is reference only.
- Native callers may omit Origin in the future; CORS is browser policy, never authentication. For now test Web + raw authenticated HTTP using 2 orgs, no Java client build required.
- For changes, update OpenAPI, TypeScript client/DTO, React/Express integration tests, README and changelog; breaking changes require separate `/api/v2` plan.
- Do NOT start future clients or infrastructure scaling beyond tested need until the project owner explicitly changes scope.

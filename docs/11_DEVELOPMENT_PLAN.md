# 11 — Development Plan (Phase 1 React Web + Express API; 2 Programmers / 8 Weeks Baseline)

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Staffing, assumptions and estimation
- แผนฐาน: **8 สัปดาห์ทำงาน (40 วันทำงาน)** สำหรับโปรแกรมเมอร์ 2 คน โดยเจ้าของโครงการช่วย PO/UAT/ตัดสินใจเร็ว
- Dev A: shared API-first backend, OpenAPI contract, database, Supabase Auth/RLS, transactional endpoints and contract tests
- Dev B: React Web, OpenAPI-generated TypeScript client, inventory/POS UI, reports, responsive UX and web printing
- ทั้งคู่ทำ code review/cross-testing; ติด deployment/security ตั้งแต่ต้น
- ประมาณการเพื่อวางแผน ไม่ใช่ commitment; ถ้าต้องมี printer silent/auto-bank confirmation จะเพิ่ม scope

## 2. Weekly milestones
| Week | Dev A (Backend/DB) | Dev B (Frontend) | Deliverable/Exit gate |
|---|---|---|---|
| W1 | Set up monorepo/CI, shared OpenAPI v1, schema/migrations, Auth/tenant/roles, RLS baseline | Design system/theme/router, responsive shell, auth/register/login | Seed Org A/B, auth and role guards; signed-off open decisions |
| W2 | Product/category CRUD, unique barcode, stock validation/audit foundation | POS layout 2-panel, list/grid, search, categories, persistent cart | End-to-end product list -> cart |
| W3 | Atomic checkout RPC, sale snapshots, payment logic, idempotency | Numpad + shortcuts, discount, cash/PromptPay UI, checkout state | Cash/PromptPay sale transactions correct; concurrency initial test |
| W4 | Stock adjustments/movements, sale void time rule, audit capture | Inventory CRUD, image upload, settings, 80mm receipt CSS | Inventory/void/printing flows usable |
| W5 | Import preview/commit, reverse audit + version lock, report queries | Excel import flow, audits/reverse UI, category and users screens | Complete core functions, validated Excel |
| W6 | Dashboard APIs, report exports, query indexes and optimization | Reports day/week/month/year & cashier filter; dashboard UI | Historical snapshot reporting & Excel export |
| W7 | Web/API contract tests + security/RLS/role test, load/lock testing | Responsive/polish/dark-light/loading/E2E, printer UAT | Feature freeze; zero P0/P1 issues |
| W8 | Staging→prod migration/monitoring/rollback, bug fixes | Full UAT, usability fixes, docs, go-live walkthrough | Owner UAT signoff and production readiness |

## 3. Dependency / critical path
`Auth + org schema + RLS -> products/categories -> checkout transaction -> stock movement + sales snapshots -> void/reports -> UAT`.

- Reports cannot be declared complete before snapshot logic tested
- UI cart can be mocked early but must switch to real server validation before acceptance
- Printing must not start before transaction commit is confirmed
- Reverse/audit requires `row_version` integrated from W2, not retrofitted at W5
- Early security/RLS tests important: refactor cost high after many module routes

## 4. P0 / P1 / P2 priorities
### P0 (must ship)
- Auth+ORGID+roles, POS cash/PromptPay manual, stock-decrement transaction, idempotency
- Inventory CRUD/adjust, barcode unique, print-dialog 80mm receipt
- Void 24h OWNER only, immutable historical snapshots, reports, basic dashboard
- Security RLS/tenant tests, soft delete and audit logs, responsive/loading, cart persist

### P1 (also required in current accepted scope)
- Excel import + downloadable template, image upload, full report exports
- Owner-only audit reverse with version check; advanced filters; dashboard polish

### P2 (out of scope for MVP)
- Silent unattended printer bridge/kiosk, bank payment verification, offline sales, multi-branch

## 5. Tickets / work packages
- EPIC 1 Platform/Identity: repo, CI/CD, migrations, auth/signup/bootstrap, multi-tenancy/RLS, RBAC/user invitation
- EPIC 2 Catalog: category/product CRUD, stock read/adjust, upload, barcode, audit/version
- EPIC 3 POS: 2-panel, responsive, barcode, cart persist, numpad, discounts, cash, PromptPay, atomic checkout
- EPIC 4 Receipts/Voids: 80mm print snapshot, sale void, stock compensation
- EPIC 5 Reporting: snapshots/aggregate queries, filters, export, dashboard
- EPIC 6 Import/Audit: XLSX template/preview/commit, before-after/reverse
- EPIC 7 Quality/Operations: RLS/integration/E2E/concurrency, monitoring, backup/restore, UAT/release

## 6. Definition of Ready (DoR)
Ticket has actor/role, acceptance scenario, org scope, DTO/schema, UI states, affected tables/migration, risks and tests.

## 7. Definition of Done (DoD)
- Source + unit tests + integration/RLS where applicable + docs updated
- No unscoped DB query, no exposed secret key, no role bypass
- Graceful loading/empty/error, accessibility, responsive Light/Dark
- Reviewed migration and indexes, rollback plan, CI green, e2e smoke
- Reviewer sign-off and traced test case from `10_TEST_ACCEPTANCE.md`

## 8. Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Printing without prompt on browsers | High scope mismatch | agree browser dialog vs local bridge in W1 |
| Incorrect cash/PromptPay settlement | High | manual confirm state/visible disclaimer; backend recomputation |
| Cross-tenant data leak | Critical | RLS + middleware + composite FK + 2-org tests |
| Overselling and double sale | Critical | transactional locking + idempotency, concurrency tests |
| Auth signup org provisioning partial | High | idempotent bootstrap/repair cleanup flow |
| Export/import large Excel times out | Medium | caps/batched RPC/streaming; performance test |
| Node memory cache inconsistency | Medium | short TTL/noncritical only, no cache for stock/rights |
| Two developers overloaded by QA | Medium | daily regression and W7/W8 buffer; reduce P2 |

## 9. Weekly reporting format
`Completed | In progress | Blocked | Risks | PR links | Tests passed/failed | Next week's target`.


## Phase 1 API/Web contract workstream (no JavaFX/Mobile code)
| Week | Task | Acceptance |
|---|---|---|
| W1 | Confirm `zoneidea/POS-Minimals` repo, initialize `apps/web`, `apps/api`, OpenAPI, Supabase migrations and GitHub CI | Both Web and API can run locally and deploy to Vercel from the same repo |
| W2 | Categories/product/inventory TypeScript DTO + Web integration | TypeScript SDK + API schema tests pass |
| W3 | Quote/sale/idempotency, stable 409/422 error codes | Web E2E + concurrency HTTP tests pass |
| W4 | Receipt snapshot JSON + print CSS/Chrome kiosk UAT | Browser print works on a real 80mm thermal printer |
| W5–W6 | Reports, XLSX exports, import and dashboard | Web UAT and role/tenant regression pass |
| W7 | Load test: up to 50 stores scenario, API error/latency/DB locks, CORS/JWT security tests | Recorded measurements; 0 oversell, 0 duplicate checkout, 0 cross-tenant data leak |
| W8 | Release `/api/v1` with OpenAPI and deployed Web App, smoke and rollback proof | Owner signs off Web App and Express API only |

**Hard scope boundary:** Do NOT create `clients/java-sdk`, JavaFX GUI, Android/iOS projects, installer packages, Java CI, or cross-client UAT in Phase 1. API remains protocol-neutral and versioned for later expansion.

## Deferred backlog — Customer display through Print Agent

Recorded: 2026-10-15. Status: **Planned only / not started**. The user requested
planning, not implementation. This extends the existing [Windows/macOS Print
Agent](55_PRINT_AGENT.md); no delivery date is committed.

### Proposed scope
- Detect primary/secondary displays, dimensions, positions, and display connection
  changes through Electron Screen API on the computer running Agent.
- Let the user identify/select a customer display and save the selection per
  computer. Independent customer content requires extended-desktop mode.
- Open a dedicated Agent window on the selected display. The POS browser sends
  validated data over the paired localhost connection; Vercel does not connect
  directly to the customer's localhost.
- Proposed content: cart items, quantities, prices, discounts, total, payment QR,
  and change. Confirm UI and message payloads before implementation.
- Send the latest snapshot on connection/reconnection and update after cart or
  payment changes. Backend-verified POS state remains authoritative for payment.
- Clear cart and QR data on logout, store change, or connection expiry. Hide QR
  after cancellation, payment success, or QR expiry.
- If the saved display disappears or changes, show a status and require selection
  again. Do not move the customer window over the cashier screen automatically.
  Display failures must not interrupt selling or existing printing.

### Design required before implementation
- Local API contract for display discovery, opening/closing the customer window,
  and ordered snapshots that prevent older updates overwriting newer data.
- Origin/Host checks and pairing-token authorization for display commands/data,
  with explicit store/device scope; no unauthenticated display-control endpoint.
- Sandboxed customer window with context isolation, no Node access, and no
  arbitrary browser-supplied HTML, script, or URLs. Accept schema-validated data.
- QR must match the current payment session/amount. Displaying QR or a customer
  action must never independently confirm payment or create a sale.
- Retain necessary activity/error logs for 30 days, excluding tokens, receipt
  content, and QR payloads.

### Future acceptance checks
- Real Windows/macOS testing: one/multiple displays, explicit selection, negative
  display coordinates, mixed scaling, unplug/replug, and Agent restart.
- Correct cart/total/QR/change updates, latest-state recovery after reconnect,
  and clearing of previous store/customer data.
- Reject unpaired or unauthorized-origin requests; preserve existing sales and
  printing behavior if the customer display fails.
- Release updated Windows/macOS installers only after tests, followed by user UAT
  before enabling the feature.

No display API, migration, UI, or Agent functionality is implemented by this plan.

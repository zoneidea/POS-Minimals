# CHANGELOG — POS Minimal Web-first Documentation

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Dashboard and reports — 2026-10-12
- Added owner Dashboard with Bangkok day/month totals, payment-method sales, low-stock and snapshot-backed SKU ranking.
- Added owner/accountant sales, inventory, low-stock and current valuation reports with date/group/cashier filters and ten-row pagination.
- Added bounded filter-matching XLSX export with literal monetary/barcode text and formula escaping; uuid dependency override resolves inherited advisory, audit 0 vulnerabilities.
- Applied development report/ranking migrations; 216 tests, typecheck/build pass; verified real Local data and XLSX download.
- Expanded OpenAPI YAML without aliases; existing parser resource guards retained.
- User live report/accountant and large-data UAT remain pending; import is the next requested item.

## Store settings and staff management — 2026-10-12
- Added owner settings Modal, live receipt preview and encrypted private store contact/payment identifier fields.
- Added staff invitation, role/status editing, suspension/reactivation, soft deletion, owner protection and management audit.
- Added verified invite context and self-service password/acceptance page; Auth Admin secret verified without exposing credentials.
- 205 tests, typecheck and API/web build pass. User confirmed live invitation and acceptance UAT passed. User confirmed settings save and member role change/suspension passed; reactivation/soft-delete UAT remains unconfirmed.

## Owner sale cancellation — 2026-10-12
- Added owner sale list and reason-required cancellation Modal, ten-row pagination and UTC deadline.
- Added atomic once-only restock, sale/product/activity audit and retained sale/payment snapshots.
- Applied additive development migration; 195 tests, typecheck and API/web build pass.
- Registered sales navigation to preserve the authenticated workspace on menu changes.
- User confirmed real cancellation and stock restoration: UAT passed. Real concurrent checkout/void testing remains pending.

## Development Supabase setup — 2026-10-12
- Connected using confirmed Session pooler and supplied Supabase CA with TLS verify-full.
- Applied identity migration; verified remote RLS, direct-write denial and bootstrap RPC grants.
- Added public CA certificate and non-secret connection example; kept database credentials local.
- Hosted signup/login, two-org UAT and multi-connection concurrency proofs remain pending.

## Identity/tenant backend — 2026-10-11
- Added atomic retry-safe bootstrap_org, identity tables, RLS and activity audit schema.
- Added authenticated Express bootstrap, strict validation, verified-email checks and stable recovery errors.
- Added a checksum-verified DatabaseInitializer and non-production migration CLI.
- PostgreSQL RLS and rollback tests plus HTTP tests: 54 passed; no migration applied to hosted Supabase.
- Deferred frontend Auth UI, invitation management, hosted integration and multi-connection concurrency proof.

## Platform foundation — 2026-10-11
- Read the complete supplied docs and OpenAPI before implementation.
- Started Express API foundation, user-scoped auth resolver, shared TypeScript contracts and HTTP security tests.
- Recorded the direct user deployment override in root DEVELOPMENT.md; deployment configuration remains pending.
- No remote database mutations; no frontend/financial feature completion claimed.

## v2.1 — 2026-10-11 (Phase 1 Web-first and official repo)
- Confirmed authoritative source repository: `https://github.com/zoneidea/POS-Minimals.git` (`zoneidea/POS-Minimals`, `main` at inspection).
- Explicitly scoped Phase 1 to **React Web App + one Node.js/Express API codebase + Supabase**; JavaFX Desktop and Native Mobile App are **future only**.
- One GitHub Monorepo with `apps/web` and `apps/api`; two Vercel Projects can deploy from different root directories of the same repository. No three-Express-project load-balancer topology.
- Removed Java/Native client codegen, installer, printer integration, contract harness and UAT release gates from Phase 1 timeline/AGENTS/workflow.
- Preserved OpenAPI `/api/v1` and native compatibility docs as informational references, not sprint requirements.
- Added `00_PHASE1_REPOSITORY_SCOPE.md`; updated README, architecture, API, tests, deployment and development plan accordingly.

## v2.0 — 2026-10-11
- Repositioned existing Node/Express + Supabase backend as **shared API** for React Web, JavaFX Desktop, and future mobile applications.
- Canonicalized routes; deprecated legacy mismatches (`/me`, `/auth/register-store`, `/inventory` Java-only, product write `/products`, `qtyDelta`).
- Defined Supabase Auth signUp -> signed `/orgs/bootstrap`; `/auth/me` for all clients; clear public vs private API boundary.
- Standardized request/response envelope, headers, DTO money decimals, versioning, 401/403/409 error semantics and Java integration guidance.
- Added printer-independent immutable receipt JSON with platform-specific Web/JavaFX/Mobile adapters.
- Added JavaFX migration mapping, auth/token lifecycle and cross-client test matrix, plus OpenAPI starter schema.
- Updated Web PRD, architecture, database, permissions, security, cache, UI, test plan, timeline, deploy, AGENTS/workflow.
- Does NOT claim to deliver JavaFX GUI source or finished Android/iOS application. Separate client implementations must use this API contract.

## 2026-10-12 — Excel product import

- Dashboard/reports user UAT Pass. OWNER-only XLSX template, preview with ten-row pagination and atomic new-product import; persisted owner/shop batch, one-hour preview expiry and once-only commit recovery.
- Initial stock movements and IMPORT audits are transactional; duplicate including deleted barcode and stale categories reject the whole batch. Migration 013 applied to development Supabase.
- 231 tests pass; live preview of 30 QA rows and real template download checked without committing QA products. Real-file import UAT pending. See docs/45_EXCEL_PRODUCT_IMPORT.md.

## 2026-10-12 — Sale bill views

- Add bill/receipt Modal from sale history and grouped sales report drilldown; show historical cashier, sold unit count, method and received amount.
- Receipt explicitly labels sale date (Bangkok) and bill/receipt number. Immutable original amounts retained for voided bills, with current void status shown separately.
- Fix missing sale_bill_view RPC by applying migration 014 to development; fix OpenAPI NotFound response and isolate shared report test timestamps. 236 tests pass, typecheck/build pass, live owner desktop/mobile checks pass.

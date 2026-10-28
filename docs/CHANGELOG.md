# CHANGELOG — POS Minimal Web-first Documentation

## 2026-10-28 — Landing AEO/GEO readiness

- Add visible, linked POSJung summary/facts and answers about product identity, internet requirements and LINE access.
- Connect website, software, organization and FAQ page entities; generate FAQ answers from the same content rendered for visitors.
- Retain static prerender, canonical domain, sitemap and private noindex policy; no API, Auth, migration or dependency changes.

## 2026-10-27 — React Native API preparation

- Add an opt-in React Native discovery profile while preserving default/integration responses, Auth/tenant/role guards and existing business APIs.
- Publish current endpoint/Auth/checkout recovery guidance for React Native, including secure storage, daily expiry and native hardware limitations.
- Update shared platform handoff and add no-Origin/native compatibility coverage; no migration, native app, new dependency or region change.

## 2026-10-23 — Table transfer destination grid

- Replace the destination dropdown with responsive selectable table buttons showing table name, zone and seats, with a visible selected state.
- Preserve free/enabled table filtering, pending transfer identity and confirmation/API behavior; block submission if the selected destination becomes unavailable.

## 2026-10-23 — Table transfers and local parked bills

- Add atomic owner/employee table transfers retaining the bill, rounds and guest QR, with destination validation, replay protection and audit.
- Add retail/cafe cart parking, recall and confirmed discard for the same browser/user, with atomic workspace persistence, storage failure and pending-payment guards.
- Keep checkout, stock deductions, queue/printing and other cart clients unchanged; document migration and API.

## 2026-10-23 — Landing contact / Resend

- Add a public contact form sending to dev@zoneidea.co.th using server-only Resend credentials and a verified sender, with visitor Reply-To.
- Add shared atomic abuse limits, honeypot, strict payload validation, safe metadata logs and Resend retry keys; preserve staff authentication and tenant APIs.
- Preserve form values on errors, disable duplicate clicks, and show timed SweetAlert2 success. Document configuration and API contract; no migration or new dependency.

## 2026-10-23 — Landing restaurant mode and second customer screen

- Promote table/zone management, per-bill QR food ordering and cash settlement after dining across hero, mode cards, onboarding copy and FAQ.
- Add a customer-display section and illustration for items, payable amount and PromptPay QR, with Agent/Extend setup guidance.
- Update SEO and structured features while retaining cafe starter promotion and current payment limitations.

## 2026-10-23 — Lighter cafe photo cards

- Reduce overlay opacity, increase minimum card width by 5%, and hide untracked-stock text only in cafe mode (Web/LINE).

## 2026-10-23 — Photo product cards across modes

- Fill square product cards with centered cover images and overlay product details on a dark gradient.
- Apply the shared treatment to retail/cafe/restaurant, LINE and guest menus; preserve loading, stock guards, pagination and cart interactions.

## 2026-10-23 — Restaurant floorplan and workspace controls

- Align fullscreen with zones and enlarge table artwork; reuse table drawings in management with enabled/disabled colors.
- Add owner-only, tenant-scoped metadata reads with a 10-second encrypted Node cache; keep live bills and sales uncached.
- Pin settings/users/collapse controls, use POS terminal navigation and restaurant food/category labels.
- Fade print-only UI warnings after two seconds; preserve payment/order error and print retry behavior.

## 2026-10-22 — Landing reflects current cafe features

- Promote cafe-only starter menus (18 drinks, 4 categories, 7 option groups), optional import and safe cleanup across hero, feature section, setup, FAQ and SEO.
- Refresh sample captures from current UI and clarify manual QR verification while automatic confirmation remains unavailable in Demo.
- Preserve authentication, APIs, domain and application workflows.

## 2026-10-22 — Optional cafe starter package

- Add owner-only preview/apply/skip after cafe shop creation, 18 image-free drinks, 4 categories and 7 appropriately assigned option groups.
- Add safe starter cleanup in Products; retain custom/pre-existing/shared data and immutable sale history, prevent duplicate imports and invalidate read caches.
- Add atomic versioned migration, provenance/RLS, API/OpenAPI contracts and DB/HTTP regression coverage.

## 2026-10-22 — Cafe quantity stepper

- Replace the choices dialog quantity input with minus/count/plus controls beside its label. Preserve stock bounds, selected choices, price totals and cart save payload.

## 2026-10-22 — Balanced Settings layout

- Keep Store information above a responsive two-column service grid; stack PromptPay/customer display opposite a full-height Printer panel.
- Match column edges with content-driven heights, normalize spacing and stack mobile display actions; preserve existing settings behavior and API contracts.

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Product image performance — 2026-10-13
- Reuse private signed image URLs for 10 minutes per user token/object within a bounded API-instance cache, after live identity/product reads.
- Keep originals and upload 600x440-bounded WebP thumbnails; POS prefers thumbnails with legacy fallback and existing tenant isolation.
- Apply additive development migration and backfill the existing image with retained original/audits; image bytes reduced from 43,252 to 13,590.
- 269 tests, typecheck/build and live Storage/catalog metadata verification pass; see [evidence and limits](51_PRODUCT_IMAGE_PERFORMANCE.md).

## Read performance — 2026-10-13
- Lazy-load workspace pages with loading/reload states; preserve route permissions and scoped cart persistence.
- Combine membership/organization identity reads; verify Auth and active membership on every request without caching.
- Add pg_trgm search/product-history/category-order indexes and bounded catalog page projection; replace per-product idle history scans with grouped aggregation.
- Add backward-compatible includeTopProducts query; Web Dashboard skips unused monthly ranking.
- Development migration applied; 262 tests, typecheck/build and fixture-based desktop/mobile browser QA pass. Local before/after measurements and limitations: [read performance evidence](50_READ_PERFORMANCE.md).

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

## 2026-10-12 — Vercel build configuration

- Pin Node 22.x and add root Vercel configuration: npm ci including build dependencies, workspace build, static SPA output and shared Express API entry.
- Fresh isolated installation/build and function entry health/auth smoke pass. Hosted deployment and dashboard Git source still require verification. See docs/47_VERCEL_DEPLOYMENT.md.

## 2026-10-13 — Hosted POS deployment

- Deployed zone-idea/pos-minimals at https://pos-minimals.vercel.app; linked the correct Git repository and production branch. Hosted SPA/assets/health/auth-boundary smoke checks pass.
- Ignore local .vercel metadata and retain env example exception. Confirm user-passed Excel import and bill viewing UAT. Supabase dashboard login/redirect setup and authenticated hosted UAT remain pending.

## 2026-10-13 — Strict-query routing and persistent load UI

- Replace Vercel named API rewrite with capture-free route to prevent path query pollution while preserving strict API validation.
- Keep table/card/form shells visible for loading/error/empty states; use named empty messages and explicit unknown financial placeholders. Guard unloaded store form against saving.
- 242 tests, typecheck and build pass. No schema migrations or business data edits.

## 2026-10-13 — Dashboard product chart cards

- Four compact responsive chart cards: completed-sale top five, lowest-selling in-stock five, and two explicitly reserved empty areas. Shared 7/15/30-day window includes current Bangkok day.
- Owner-scoped read-only ranking RPC, new API contract, native accessible SVG charts and persistent load/error/empty shells. No chart dependency added.
- 248 tests/typecheck/build pass; migration applied to development Supabase.

## 2026-10-13 — Interactive Dashboard charts
- Use MUI X donut for best sellers and scatter for stock versus low sales, with hover/click details, theme support and animation.
- Add a six-month revenue line chart using existing tenant-scoped report data; remove Dashboard sell shortcut.
- Keep four compact product cards, rolling periods and empty/error shells; load chart dependencies only on Dashboard.
- Focused tests, typecheck, build and isolated desktop/mobile browser QA passed; authenticated hosted UAT pending.

## 2026-10-13 — Compact Dashboard and menu captions
- Place compact product charts before the large revenue chart; reduce Dashboard heading/metric/chart spacing.
- Remove Dashboard introductory note and report/inventory shortcuts, and remove manual reload buttons across pages. Mutation-triggered refresh and pagination remain unchanged.
- Show responsive captions under Sidebar icons with a scrollable rail on short screens.

## 2026-10-13 — Daily sales, employee receipt copies and report layout
- Employees gain sales menu and own daily sales, with database-scoped own receipt access; report drilldown and void remain restricted.
- Sales list defaults to current Bangkok calendar day. Void rechecks the Bangkok sale day after both sale and product locks; next-day requests fail without restock, retaining replay behavior.
- Receipt Modal prints a separate 80 mm copy marked สำเนา with every item, including canceled-bill status; HTML snapshots are escaped. Browser print dialog requires user printer selection.
- Fixed header and compact report filters; remove summary cards from sales reports while preserving inventory report summaries.
- Complete pending idle-stock graph and additive contract/migration.

## 2026-10-13 — Product span definition
- Change long-held product ranking to calendar days from product creation to latest completed sale, as requested. Exclude never-sold goods rather than treating today as a sale date.
- Show creation/latest-sale dates in chart details; retain minimum 7/15/30-day span controls and tenant isolation.

## 2026-10-13 — Never-sold product span
- Include never-sold stocked products by creation-to-today Bangkok calendar days; sold goods still end at latest completed sale.
- Keep lastSaleDate null and show an explicit never-sold label; update API contract and migration.
- 41 focused tests and typecheck pass.

## 2026-10-13 — Shared footer
- Add POWERED BY ZONE-IDEA INNOVATION CO.,LTD. to the shared application footer, including signed-out, recovery, invitation and workspace pages. Responsive, themed, and outside receipt print content.

## 2026-10-13 — Fixed compact footer
- Pin shared footer to viewport bottom at 24 px; reserve document space and offset workspace footer beside the Sidebar.

## 2026-10-14 — Required store registration contact
- Add required telephone to signup/onboarding with shared email/telephone validation.
- Initialize encrypted telephone atomically with store creation; retain verified account email and existing-store retry behavior.
- Focused validation/encryption/transaction/anonymous-access tests, typecheck and build pass; development migration applied. Existing locally removed regression tests remain untouched.

## 2026-10-14 — Payment configuration
- Add owner QR/Gateway configuration, encrypted bank details, masked account views and accountant read-only settings.
- POS displays configured QR or Gateway pending-integration state. Gateway and PromptPay sale commit are not enabled.
- Repair Vercel API imports, required markers and maximum ten-character phone validation.

## 2026-10-14 — ReservePay contact registration
- Post saved store ID/name/phone and verified account email after successful bootstrap.
- Keep credentials server-only and track external result without plaintext contact logs.
- Prevent duplicate POSTs and preserve created store when delivery fails or is uncertain.

## 2026-10-14 — ReservePay bank link
- Link saved Gateway bank account after owner-only save using store IDs, three-digit bank code and server-only credentials.
- Track same-save delivery, redact diagnostics and retain local save when provider calls fail.
- ReservePay add-contact UAT confirmed Pass by user.

## 2026-10-14 — Shared SweetAlert2 feedback
- Timed 1.5-second save success, confirmations before data changes/removal and action-error warnings.
- Keep native form Modals compatible with alerts; align masked bank details on one responsive row.

## 2026-10-18 — Coupon Marketplace demo

- ซื้อจำลองโมดูลคูปองฟรีแบบแยกร้าน พร้อม module guards ทั้งหน้าเว็บ/API/RPC
- จัดการคูปองผ่าน Modal และ soft delete; โค้ด มูลค่าเงินบาท วันเริ่ม/สิ้นสุด จำนวนและท้ายใบเสร็จ
- Checkout คำนวณและตัดสิทธิ์คูปองใน transaction เดียวกับการขาย มี idempotency/void reversal; รองรับ Gateway เดิม
- รายงานคูปองมีช่วงวันไทย สรุปส่วนลด และตารางหน้าละ 10 รายการ เฉพาะร้านที่เปิดโมดูล

## 2026-10-18 — Compact workspace

- แสดงเวอร์ชันระบบ v1.0.0 บน Header โดยอ่านจาก package.json
- ลดขนาดการ์ดสินค้า POS และ Marketplace โดยคงรูปทรงจัตุรัส
- Sidebar ย่อเป็นไอคอนหรือขยายพร้อมชื่อเมนูได้ และจำสถานะในเครื่อง; คงสิทธิ์และลำดับเมนูเดิม

## 2026-10-18 — Report financial overview

- เพิ่มภาพรวมการเงินในรายงานยอดขาย: ยอดขายสุทธิไม่รวม VAT, ต้นทุนขาย ณ วันขาย และกำไรขั้นต้น/Gross Margin
- เรียงทั้ง 3 การ์ดในแถวเดียวกัน ใช้ช่วงวัน/พนักงานเดียวกับรายงาน; จอเล็กเลื่อนภายในการ์ดสรุปได้
- ไม่แสดงหรือพัฒนาค่าใช้จ่ายดำเนินงาน ตามขอบเขตที่ผู้ใช้ยืนยัน
- เพิ่ม financial ใน response เดิมโดยคง summary/ตาราง/Excel เดิม และจำกัดสิทธิ์เจ้าของร้าน/บัญชีเช่นเดิม

## 2026-10-18 — User acceptance confirmed

- ผู้ใช้ยืนยัน Pass ทั้ง 4 ข้อ: ภาพรวมการเงิน/ตัวกรองจริง, โมดูลคูปองครบขั้นตอนรวม void คืนสิทธิ์, Fullscreen บนเครื่องจริง และขนาดการ์ด/Sidebar
- บันทึกเฉพาะผล UAT; ไม่มีการแก้โค้ด ข้อมูลธุรกิจ หรือเปิดฟีเจอร์ที่พักไว้

## 2026-10-18 — Cross-platform API preparation

- เพิ่ม opt-in integration profile ของ client/config โดยคง default response เดิม; ไม่มี migration หรือ Native app/SDK ใหม่
- ระบุ production API base URL และ typed discovery ใน OpenAPI; ทำเครื่องหมาย planned สำหรับ legacy draft endpoints ที่ไม่มี mounted route
- เพิ่มคู่มือ API ปัจจุบันและแผนรวม; ยังไม่เลือก OS/framework, ไม่เปิด Gateway native/offline checkout

## LINE MINI App — 2026-10-20

- Add isolated `/line/` HTML/client/styles; initialize the supplied Developing LIFF ID before loading the application.
- Use a separate Supabase session/cart/pending-operation namespace with existing protected catalog, cash quote/checkout/recovery and daily sales/receipt APIs.
- Add mobile cart, cash numpad/change, digital receipt and new-sale flow; retain immutable operation keys for recovery.
- Existing API, DB, legacy App/POS/auth and public landing implementation remain unchanged. See [setup, contract and verification](75_LINE_MINI_APP.md).
- User confirmed actual LINE on-device testing **Pass** on 2026-10-20; acceptance recorded without extending feature scope or asserting unreported test scenarios.

## LINE → Web SSO — 2026-10-20

- Add explicit same-origin session handoff to “เปิดระบบเว็บ”, with existing identity/day-policy validation and confirmation before replacing another Web account.
- Use Supabase SDK session installation and then one shared Auth storage key/refresh lifecycle; retain separate scoped carts and pending-sale operations. No credentials in URLs.
- Existing Web/API/DB source/contracts unchanged; no new provider, dependency or migration. External-browser handoff is outside this slice; real LINE SSO UAT remains pending.

## POSJung branding — 2026-10-20
- Rename visible Web/LINE/Landing text and SEO to POSJung; use supplied wordmark/icon, new share artwork and refreshed sample screenshots. Preserve domain, API/DB/auth contracts and saved sessions.
- Refresh email-template and Print Agent source branding; hosted email templates, LINE Console identity and distributed native binaries require separate publication.
- Record user-confirmed LINE → Web SSO Pass.

## Custom-domain Sitemap — 2026-10-20
- Use https://posjung.com as the shared public SEO URL for Sitemap, robots, canonical, social artwork and JSON-LD; keep private routes noindex and out of the Sitemap.
- Update the LINE canonical only; retain all API/Auth/Agent behavior and existing route handling.

## LINE Published entry — 2026-10-20
- Add /line/published/ for owner-supplied LIFF ID 2012103467-h4JHbf2A; retain Developing /line/ and its existing configuration. Both entries reuse the current LINE client and SSO with unchanged API/DB contracts.
- Add independent optional Published ID override, route/noindex checks and SDK initialization regression tests. Console Endpoint configuration and real Published on-device acceptance remain owner steps after deploy.

## Agent 1.1.0 and customer display — 2026-10-20
- Add posjung.com as an exact trusted Agent Origin, retaining the original origin and print protocol.
- Add optional per-device customer-screen settings, external-monitor selection and authenticated local frame streaming for cart, quote, PromptPay QR and confirmed change.
- Blank stale/expired QR and released sessions, isolate concurrent POS pages, and preserve sale/stock/payment/printing behavior. Native installer publication and real dual-monitor UAT are recorded separately in the display contract.


## 2026-10-20 — posjung-agent 1.1.2
- Fix oversized macOS status-bar icon with an 18px monochrome Template and Retina asset.
- Rename application/window/tray/installer/downloads to posjung-agent; retain existing package/app identity and userData pairing path.
- Add native tray/identity regression checks; printing, customer display and cloud APIs remain compatible.


## 2026-10-20 — Marketplace module activation
- เพิ่ม OWNER เปิด/ปิดโมดูลที่ซื้อแล้ว โดยคงสิทธิ์ซื้อขาดและเปิดกลับได้โดยไม่ซื้อซ้ำ
- แยกสถานะซื้อกับสิทธิ์ใช้งานในการ์ด/Modal, ซิงก์แท็บอื่นและล้างคูปองที่ยังไม่ส่งขายเมื่อปิด
- เพิ่ม audited owner RPC/strict PATCH route, additive ownership metadata และ generated contract; ใช้ org_modules เดิม
- ไม่ลบคูปอง/ประวัติ/บิล; การขายปกติและ recovery/void ของบิลเดิมยังทำงานเมื่อโมดูลปิด

## 2026-10-22 — Cafe store mode

- Add retail/cafe selection in onboarding and owner settings, preserving existing retail shops and API callers.
- Issue immutable daily cafe queues atomically with cash/Gateway sales, retaining replay/stock/coupon safeguards.
- Print receipt with queue, then preparation ticket; add separate preparation reprint without order statuses.
- Update public landing/SEO for modes and remove fee copy; menu modifiers remain deferred.

## 2026-10-22 — Store mode selection buttons

- Replace the settings dropdown with labeled retail/cafe icon buttons and an explicit selected state. Existing save/confirmation/cancel, loading/disabled behavior and onboarding dropdown remain unchanged.

## 2026-10-22 — Cafe options and item notes

- Add owner-configured reusable choice groups, default/min/max selection, per-unit topping prices and product assignments.
- Add cafe option/note/quantity selection and variant cart editing to Web and isolated LINE transport; retain direct-add retail behavior.
- Snapshot choices and notes in cash/Gateway bills, sequential receipt/preparation printing and customer display; aggregate product stock/void per product.
- Add scoped/RLS-protected RPCs, additive API models and regression tests; no separate topping inventory or Agent update. See [contract and validation](78_CAFE_OPTIONS.md).

## 2026-10-22 — Cafe product management and onboarding buttons

- Use mode buttons in shop creation; rename inventory navigation/page to สินค้า without changing URLs or permissions.
- Move reusable cafe menu groups to Products and hide the panel for retail shops.
- Simplify cafe product forms to name, size/topping/sweetness groups and price, retaining stock/image/cost/barcode fields under Additional information.
- Save optional product/group assignments atomically using legacy product/stock routines, with OWNER/tenant/mode checks and stale-assignment protection.
- Align option inputs and fix mobile grid overflow, preserving dark mode and existing sale/payment/printing behavior.

## 2026-10-22 — Cafe optional stock and workspace controls

- Add owner-selected cafe stock opt-out with atomic policy/product/group auditing; preserve tracked retail checkout and exact void restock. Exclude untracked cafe menus from low-stock alerts.
- Move product image/category below name, add themed upload preview tile and keep cafe group assignment in product forms only.
- Restore SweetAlert scroll/ARIA/keyboard cleanup when its host dialog unmounts; improve staff toolbar spacing.
- Move icon-only logout beside header theme switch and icon-only sidebar collapse to the bottom.
- Add optional stock API contract and migration; verify cashier/owner/tenant protection, cash/Gateway/idempotency/void and mobile dark UI.

## 2026-10-22 — Compact cafe options and checkout actions

- Collapse/expand cafe option settings from Products; arrange POS choice cards in two columns.
- Show cash change in red and simplify the verified checkout total label.
- Align bill receipt-copy/preparation printing and Close actions with matching control heights.
- Validate desktop/mobile/dark layouts and existing cafe/printing calculations; no API or database changes.

## 2026-10-22 — Destructive actions and owner member controls

- Use consistent red buttons for logout, product/category removal, sale void and POS cart clearing.
- Add direct owner-only member suspension/reactivation alongside confirmed membership removal; protect owners and invitation acceptance.
- Reuse existing versioned staff API, tenant checks, audits and session invalidation; add role/tenant/stale-write regression checks.

## 2026-10-23 — Restaurant mode, staff/cash slice

- Added restaurant mode selection, owner table/zone/seat setup, one open bill per table and multiple immutable preparation rounds.
- Added atomic whole-bill cash settlement, automatic receipt printing, original-request recovery and owner round cancellation with reasons.
- Retained retail/cafe sale APIs, stock/void/report ledgers and LINE SSO; restaurant LINE users use Open Web. Guest QR ordering and restaurant PromptPay are pending. See [restaurant contract and verification](80_RESTAURANT_MODE.md).

### 2026-10-23 — Restaurant tables and shared cash Checkout
- Dedicated owner table menu and standard table forms; green/red floorplan with configured chairs.
- Select table directly into menu/cart, retain confirmed rounds, send additions and settle through shared cash Checkout.
- Server-owned bill quote supports manual discount, VAT and entitled coupons; backwards-compatible cash RPC/recovery.
- Verified 117 files / 526 tests, typecheck/build and desktop/mobile fixture UI.

### 2026-10-23 — Compact tables, side cart and zone management
- Occupied-table selection retains floorplan with a right-hand order cart and horizontal order/payment actions.
- Smaller table cards retain chair counts/status, with responsive stacked mobile cart.
- Owner zone create/edit/delete modal and persistent empty zones; versioned assignment updates and occupied-zone guards preserve table/order history.

### 2026-10-23 — Restaurant usability fixes
- Standard zone action sizes and stable table management on window refocus.
- Shared compact product grid and confirmation before opening free tables.
- Clear print notices on navigation, ignoring delayed results from prior views.

### 2026-10-23 — Restaurant guest QR ordering
- Scoped per-bill QR issuance/revocation/printing and standalone mobile `/order/` menu.
- Guest options/notes/cart, server-priced order rounds, durable idempotency and retry recovery.
- Revocation/expiry/closed-bill guards, rate limits, tenant isolation and truthful guest audit/source.
- POS guest-round visibility and explicit preparation-ticket printing; existing cash settlement remains.

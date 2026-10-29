# POSJung

## Gateway expiry verification — 2026-10-29

The existing ReservePay deadline is verified by the backend; no QR lifetime is added or extended. Countdown expiry hides the QR and rechecks the original payment. Only provider-confirmed EXPIRED releases the draft for a new user-clicked QR. Old server payment rows and browser reference history are retained for late-result investigation; no automatic replacement QR or provider cancellation endpoint is invented. See [expiry behavior](docs/63_RESERVEPAY_POS_QR.md#verified-expiry-and-manual-retry--2026-10-29).

## Payment Gateway selection — 2026-10-29

Owners can select Payment Gateway in Store settings again and save their receiving-bank setup. Existing ReservePay server verification, tenant/role checks and per-shop opt-in remain in force. No shop is automatically enabled; restaurant table settlement remains cash-only.

## Landing answer/search readiness — 2026-10-28

The public landing now includes a visible product summary, linked capability facts and 14 FAQs, with matching connected Organization/WebSite/SoftwareApplication/WebPage/FAQPage JSON-LD in both initial HTML and runtime metadata. See [SEO/AEO/GEO delivery](docs/66_PUBLIC_LANDING_SEO.md#answer-and-generative-search-readiness--2026-10-28). Business APIs and private-route indexing policy are unchanged; AI citations and rankings are not guaranteed.

## React Native API preparation

[React Native API handoff](docs/84_REACT_NATIVE_API.md) documents the shared production API, secure Auth lifecycle, current retail/cafe/restaurant routes and checkout recovery. Opt-in `/api/v1/client/config?profile=react-native` adds credential-free guidance; legacy/integration responses remain unchanged. Native app screens, hardware adapters and Expo/bare runtime selection are subsequent work.

Multi-tenant POS: React Web + Express API + Supabase in one repository.

## Current branding — 2026-10-20

POSJung uses the supplied wordmark and emblem across Web, Landing and LINE MINI App, with matching SEO metadata and sample captures. Public SEO URLs now use https://posjung.com; authentication/storage identifiers stay unchanged; see [branding](docs/70_KIDTANG_BRANDING.md). The user confirmed MINI App → Web SSO **Pass**.

## Specifications

Read [docs/README.md](docs/README.md), [docs/00_PHASE1_REPOSITORY_SCOPE.md](docs/00_PHASE1_REPOSITORY_SCOPE.md), and [DEVELOPMENT.md](DEVELOPMENT.md) before changing code. Direct user instructions take precedence; frontend/API must deploy together. The two-project topology in the supplied docs is overridden by that instruction.

## Current milestone

Identity/tenant backend slice: `/api/v1/health`, `/api/v1/client/config`, `/api/v1/auth/me`, authenticated `/api/v1/orgs/bootstrap`, user-scoped Supabase adapter, HTTP error envelopes, safe logs, shared OpenAPI types and CI.

Versioned migration creates organizations, memberships, store settings and append-only application activity logs. RLS restricts reads by active membership/role; direct authenticated writes are denied. Bootstrap runs as a narrowly granted DB transaction, verifies email, serializes per user and returns the existing organization on retry.

The React authentication frontend and [password recovery](docs/23_PASSWORD_RECOVERY.md) are implemented; [category management](docs/25_CATEGORIES.md) is implemented; [inventory CRUD](docs/30_INVENTORY_PRODUCTS.md) is implemented; [stock adjustments/history](docs/31_STOCK_ADJUSTMENTS.md) are implemented; [stock audit page](docs/33_STOCK_AUDIT_PAGE.md) is implemented; [POS product catalog](docs/34_POS_CATALOG.md) is implemented; [POS reference layout and draft cart](docs/35_POS_REFERENCE_LAYOUT.md) and [Grid/List catalog views](docs/41_POS_CATALOG_CART_UI.md) are implemented with the [shared-theme Checkout Modal](docs/37_POS_CHECKOUT_MODAL.md); [cash quote API](docs/38_CASH_QUOTE.md) is implemented; [optional product images](docs/40_OPTIONAL_PRODUCT_IMAGES.md) are implemented with user-confirmed Storage policy setup and real upload UAT passed; [atomic cash checkout](docs/39_CASH_CHECKOUT.md) is implemented with user-confirmed real cash sale, stock-change and network-interruption UAT passed; [owner sale cancellation with atomic restock and audit](docs/42_SALE_VOID.md) is implemented with user-confirmed live cancellation/restock UAT passed; [store settings and staff management](docs/43_STORE_SETTINGS_STAFF.md), including direct owner-only member disable/re-enable/removal controls, are implemented with server Auth Admin configuration verified and user-confirmed invitation/acceptance UAT passed; [Dashboard and four reports with filtered Excel export](docs/44_DASHBOARD_REPORTS.md) are implemented with user-confirmed UAT passed; [Excel product import](docs/45_EXCEL_PRODUCT_IMPORT.md) is implemented with user-confirmed real-file import UAT passed; [Dashboard product ranking charts](docs/48_DASHBOARD_PRODUCT_CHARTS.md) add interactive MUI X donut/scatter charts, selectable 7/15/30-day rankings, a six-month revenue line chart and two reserved cards; [Historical bill viewing](docs/46_SALE_BILL_VIEWS.md) is implemented from sales and grouped sales reports with user-confirmed UAT passed; [Daily sales access and receipt copies](docs/49_DAILY_SALES_RECEIPT_COPY.md) are implemented; PromptPay checkout and physical-printer UAT remain pending. UI uses the shared white/blue reference theme with responsive sidebar, square photo cards with overlaid product details and dark mode; see [theme QA](design-qa.md) and the [modern design system](docs/32_MODERN_UI.md). See [Web authentication](docs/21_WEB_AUTH_IMPLEMENTATION.md). Identity migration `202610110001_identity_tenants.sql` was applied to the confirmed development Supabase project on 2026-10-12. Remote table RLS/grants and bootstrap function permissions were verified; no organizations or test accounts were created during migration verification. The user subsequently confirmed signup, email verification, login and owner/store details. SQL/RLS tests run on isolated PGlite PostgreSQL with an Auth shim; they do not prove multi-connection concurrency. See [identity test evidence](docs/20_IDENTITY_IMPLEMENTATION.md).

## Restaurant mode

[Restaurant phase 1](docs/80_RESTAURANT_MODE.md) adds table/zone setup with metadata-only Node cache and graphical management, open bills, additional rounds and preparation tickets, followed by atomic cash settlement and receipt printing. Retail/cafe behavior remains available. [Guest QR ordering](docs/81_RESTAURANT_GUEST_ORDERING.md) provides per-visit mobile ordering into open bills; table PromptPay is a subsequent phase; stock is checked at send and deducted at settlement without reservations.

## Cafe store mode

[Optional cafe starter data](docs/79_CAFE_STARTER_DATA.md) offers 4 categories, 18 menus and 7 option groups without images after cafe onboarding. Owners can preview/apply once or start empty, and clear uncustomized starter data from Products while retaining shop-created/customized data and sales history.

[Retail/cafe mode](docs/77_CAFE_STORE_MODE.md) uses selection buttons when creating a shop and in owner Store settings. Cafe menu groups are managed from a collapsible panel in Products (สินค้า); POS choice cards use two columns. Cafe commits issue a daily queue and print a receipt followed by a preparation ticket. Existing shops remain RETAIL. [Cafe options, toppings and item notes](docs/78_CAFE_OPTIONS.md) add owner-configured groups, per-unit pricing and immutable receipt/preparation details; topping inventory remains deferred. Cafe products can optionally disable stock tracking; product image/category sit below the name, and option assignments are managed in product forms. Existing products retain tracking and RETAIL retains stock checks. Landing content and SEO explain all three store modes and the second customer screen for items, payable totals and PromptPay QR, without fee copy.

## Customer display and Agent custom domain

[posjung-agent and customer display](docs/76_CUSTOMER_DISPLAY_AGENT.md) adds posjung.com pairing and an optional second-monitor panel in Store settings. POS streams selected items, quoted amount/change and existing PromptPay QR through the same authenticated loopback bridge; checkout/printing remain independent. Install the updated Agent, pair from the new domain and select an extended second screen. Physical two-monitor/printer acceptance remains separate from automated tests.

## Cross-platform preparation

[Current API integration guide](docs/73_CROSS_PLATFORM_API_GUIDE.md) and [development roadmap](docs/74_CROSS_PLATFORM_DEVELOPMENT_PLAN.md) prepare external clients without selecting or building a Native App. `GET /api/v1/client/config?profile=integration` returns public protocol metadata; the default config response stays unchanged. Cash flows use the existing protected API; Native Gateway and offline checkout are not ready.

## LINE MINI App development entry

[Isolated LINE MINI App](docs/75_LINE_MINI_APP.md) adds Developing `/line/` and Published `/line/published/` with distinct LIFF IDs and shared LIFF initialization, a private POSJung session before opt-in, a scoped cart, cash checkout and digital receipts. “เปิดระบบเว็บ” now offers same-browser SSO through the existing Supabase session; after opt-in, Web and MINI App share login/logout. Existing Web POS/API/DB contracts are unchanged. The user confirmed real LINE on-device testing **Pass** on 2026-10-20; see the acceptance record for scope.

## Latest user acceptance — 2026-10-18

The user confirmed **Pass** for all four outstanding checks: financial overview with real sales and date/cashier filters; the coupon demo-purchase/create/redeem/report/void-restoration flow; POS fullscreen on the actual POS machine; and compact cards/collapsible sidebar. Real module billing, operating expenses and second-display support remain outside this acceptance scope.

## Report financial overview

The sales report includes net sales excluding VAT, historical COGS and gross profit/margin from the same filtered report query; see [financial overview contract](docs/44_DASHBOARD_REPORTS.md#financial-overview-2026-10-18).

## Read performance

[Node read cache](docs/60_NODE_READ_CACHE.md) reuses scoped store/category/product/staff data with bounded TTL, encrypted process memory and mutation invalidation. Authorization remains live.

[Optional Upstash shared cache](docs/67_UPSTASH_READ_CACHE.md) shares encrypted store
and category reads across Vercel instances, with cross-instance invalidation and
database fallback. Other cached resources retain their existing Node cache.

[Redis session authority](docs/68_REDIS_SESSION_AUTHORITY.md) now reuses verified
identity/session context for up to five minutes, with request-local deduplication,
role-change fencing, logout revocation and live Supabase fallback. This supersedes
the earlier live-identity-per-read policy when Redis authority is enabled.

[Read performance improvements](docs/50_READ_PERFORMANCE.md) cover lazy workspace pages, joined identity reads, indexed literal catalog search, grouped idle-product history and an optional metrics-only Dashboard summary. The additive migration was applied to the documented development Supabase target before the API release; API callers retain the existing default response.

[Product image performance](docs/51_PRODUCT_IMAGE_PERFORMANCE.md) adds private signed-URL reuse and separate POS thumbnails, retaining originals and existing API payloads. The development migration and existing-image backfill are applied.

## Local setup

Requires Node.js 22.x and npm.

```bash
npm ci
npm run contracts:generate
npm run typecheck
npm test
npm run build
npm run dev:api
# In another terminal:
npm run dev:web
```

Root `.env.local` provides `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; optional `PORT` and `APP_ALLOWED_ORIGINS` (comma-separated exact origins). See `.env.example`; `SUPABASE.md` is kept locally and excluded from Git. DB credentials must stay server-only. Never commit `.env.local`.

Development API listens on `http://127.0.0.1:8080`. Built server: load root environment variables then `npm run start -w @pos/api`. Local request/response metadata logs use dated `logs/api-YYYY-MM-DD.jsonl` files; headers, bodies, query parameters and tokens are excluded. [Activity history and application log retention](docs/54_ACTIVITY_HISTORY_LOG_RETENTION.md) adds owner activity filtering and persistent production diagnostics, retained for 30 days with an hourly Supabase cleanup job. Sales and stock business history remain intact.

## Vercel deployment

Use repository root with the settings and environment variables in [Vercel deployment](docs/47_VERCEL_DEPLOYMENT.md). Root vercel.json publishes the Web and existing Express API in one deployment. Live deployment: https://pos-minimals.vercel.app. Hosted SPA routes, static assets, health and unauthenticated API checks pass; authenticated hosted UAT and Supabase redirect configuration remain pending.

## Printer companion

posjung-agent 1.1.2 uses a native-size macOS Template/Retina tray icon and the new application/installer name, retaining existing pairing data.

[posjung-agent](docs/55_PRINT_AGENT.md) adds local printer pairing, default/named printer selection, automatic receipt submission after confirmed checkout, content-sized 58/80mm receipts and Windows/macOS installer links in store settings. Physical printer and OS installation UAT remain required.

## Search and social metadata

The public `/` is a Thai landing page with the existing sign-in/sign-up flow.
[Landing page and SEO delivery](docs/66_PUBLIC_LANDING_SEO.md) documents approved
build-time prerendering, route-specific noindex/canonical metadata, structured data,
public sample screenshots/share image, sitemap and Search Console setup.
Only the home page is included in the sitemap. Application/recovery/invitation
routes receive noindex HTML; business API authentication remains unchanged.
Withdrawal requests are not implemented and are explicitly marked unavailable.

## Repository

Official remote: `https://github.com/zoneidea/POS-Minimals.git`.
Source modules: `apps/api`, `apps/web`, `packages/contracts`.
`contracts/openapi.yaml` is the canonical contract; regenerate types after contract changes. `supabase/migrations` contains the identity migration; `supabase/tests` contains an isolated test-only Auth fixture.

## Database initialization

`DatabaseInitializer` applies pending migrations in order, checks checksums and records history under `private.schema_migrations`. A migration error rolls back that migration; earlier completed migrations remain applied. Run only after confirming a non-production target:

```bash
DB_ENVIRONMENT=development npm run db:migrate
```

The command reads `DATABASE_URL` from the root `.env.local`. Production rollout is a separate reviewed release task. Never run `supabase/tests/auth-fixture.sql` against Supabase: its `auth.*` schema is supplied only by the isolated test harness.

## Development database TLS

Use the confirmed Session pooler host `aws-0-ap-southeast-2.pooler.supabase.com:5432` with username `postgres.jibqgpfzmaqsjclbuaxn`. Keep `sslmode=verify-full` and set `sslrootcert` to the supplied `prod-ca-2021.crt` file (an absolute file path in local `.env.local`, or root-relative as in `.env.example`). The certificate is a public Supabase CA, not a private key. Despite its filename, this project is the confirmed development database. Credentials remain excluded from Git.

## Required registration contact
Store registration/onboarding requires a valid account email and telephone; see [Web authentication](docs/21_WEB_AUTH_IMPLEMENTATION.md). Telephone is encrypted in store settings during atomic provisioning.

## Payment configuration
[Uploaded QR and provider-independent Gateway settings](docs/56_PAYMENT_SETTINGS.md) include masked bank-account data and accountant read-only access. Gateway payment verification, atomic PromptPay sale completion and fee/net reporting are implemented; see [Gateway sales and reports](docs/64_GATEWAY_SALES_REPORT.md).

## ReservePay contact registration
[ReservePay contact integration](docs/57_RESERVEPAY_CONTACT.md) sends saved contact details after store bootstrap using server-only RESERVEPAY_API_KEY, with durable duplicate suppression and independent store-save success.

## ReservePay bank linking
[Bank linking after owner account save](docs/58_RESERVEPAY_BANK_LINK.md) uses persisted encrypted account details and reports external status independently from local save.

## Action feedback
[SweetAlert2 feedback](docs/59_SWEETALERT_FEEDBACK.md) provides timed save success, mutation confirmation and warning dialogs, with an aligned masked bank-account row.

## Daily login expiry
[Daily session policy](docs/61_DAILY_SESSION_EXPIRY.md) ends each POS session at the next midnight in Asia/Bangkok, independent of token refresh, with API enforcement and browser auth-only cleanup.

## ReservePay browser SDK
[POS SDK initialization](docs/62_RESERVEPAY_BROWSER_SDK.md) loads the requested public
ReservePay installation when entering POS, without changing payment confirmation.

[ReservePay POS QR](docs/63_RESERVEPAY_POS_QR.md) adds Gateway QR creation, printing
and status checks. Server verification now posts Gateway bills and supports the dedicated fee/net report; see [Gateway sales and reports](docs/64_GATEWAY_SALES_REPORT.md).

[Gateway fee and cancellation](docs/69_GATEWAY_FEE_VOID.md) calculates 1.5% per bill
in reports and confirms ReservePay voids before atomic stock restoration.

[KidTang branding](docs/70_KIDTANG_BRANDING.md) covers current display names, SEO metadata,
public sample/share images and compatibility with existing URLs and stored data.

## Marketplace demo modules

Owners can disable/re-enable acquired modules in Marketplace. One-time ownership, coupon data and history remain intact; reactivation does not purchase again. Effective access is enforced by the existing API/RPC guards.

[Coupon/discount module](docs/72_COUPON_MODULE.md) lets owners simulate a free
purchase in Marketplace, create dated fixed-THB coupon codes with usage limits,
and enable cashier redemption and owner/accountant usage reports. Module rights
are stored per organization and enforced by RPC/RLS; checkout deducts a coupon
use atomically and void restores it once. This is a demo purchase, with no real
module payment, automatic renewal or debit.

Restaurant table/cart update: owner management is under `/tables`; restaurant POS shows a chair-count floorplan and existing orders in the cart. Table payment uses shared cash Checkout with manual discounts, VAT and entitled coupons. See [restaurant contracts and deployment notes](docs/80_RESTAURANT_MODE.md).

## Contact form

[Landing contact / Resend](docs/82_CONTACT_FORM.md) sends public enquiries to dev@zoneidea.co.th through a server-only verified sender, with shared abuse limits and retry deduplication. No staff login is required; existing staff APIs retain their session guards.

## Table transfers and parked bills

[Table move / parked bill behavior](docs/83_TABLE_MOVE_PARKED_BILLS.md): restaurant staff can transfer an open bill to another free table. Retail/cafe Web POS can park and recall up to 50 drafts in the same browser/user/shop; normal checkout remains authoritative.

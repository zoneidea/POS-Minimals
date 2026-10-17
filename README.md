# KidTang

Multi-tenant POS: React Web + Express API + Supabase in one repository.

## Specifications

Read [docs/README.md](docs/README.md), [docs/00_PHASE1_REPOSITORY_SCOPE.md](docs/00_PHASE1_REPOSITORY_SCOPE.md), and [DEVELOPMENT.md](DEVELOPMENT.md) before changing code. Direct user instructions take precedence; frontend/API must deploy together. The two-project topology in the supplied docs is overridden by that instruction.

## Current milestone

Identity/tenant backend slice: `/api/v1/health`, `/api/v1/client/config`, `/api/v1/auth/me`, authenticated `/api/v1/orgs/bootstrap`, user-scoped Supabase adapter, HTTP error envelopes, safe logs, shared OpenAPI types and CI.

Versioned migration creates organizations, memberships, store settings and append-only application activity logs. RLS restricts reads by active membership/role; direct authenticated writes are denied. Bootstrap runs as a narrowly granted DB transaction, verifies email, serializes per user and returns the existing organization on retry.

The React authentication frontend and [password recovery](docs/23_PASSWORD_RECOVERY.md) are implemented; [category management](docs/25_CATEGORIES.md) is implemented; [inventory CRUD](docs/30_INVENTORY_PRODUCTS.md) is implemented; [stock adjustments/history](docs/31_STOCK_ADJUSTMENTS.md) are implemented; [stock audit page](docs/33_STOCK_AUDIT_PAGE.md) is implemented; [POS product catalog](docs/34_POS_CATALOG.md) is implemented; [POS reference layout and draft cart](docs/35_POS_REFERENCE_LAYOUT.md) and [Grid/List catalog views](docs/41_POS_CATALOG_CART_UI.md) are implemented with the [shared-theme Checkout Modal](docs/37_POS_CHECKOUT_MODAL.md); [cash quote API](docs/38_CASH_QUOTE.md) is implemented; [optional product images](docs/40_OPTIONAL_PRODUCT_IMAGES.md) are implemented with user-confirmed Storage policy setup and real upload UAT passed; [atomic cash checkout](docs/39_CASH_CHECKOUT.md) is implemented with user-confirmed real cash sale, stock-change and network-interruption UAT passed; [owner sale cancellation with atomic restock and audit](docs/42_SALE_VOID.md) is implemented with user-confirmed live cancellation/restock UAT passed; [store settings and staff management](docs/43_STORE_SETTINGS_STAFF.md) are implemented with server Auth Admin configuration verified and user-confirmed invitation/acceptance UAT passed; [Dashboard and four reports with filtered Excel export](docs/44_DASHBOARD_REPORTS.md) are implemented with user-confirmed UAT passed; [Excel product import](docs/45_EXCEL_PRODUCT_IMPORT.md) is implemented with user-confirmed real-file import UAT passed; [Dashboard product ranking charts](docs/48_DASHBOARD_PRODUCT_CHARTS.md) add interactive MUI X donut/scatter charts, selectable 7/15/30-day rankings, a six-month revenue line chart and two reserved cards; [Historical bill viewing](docs/46_SALE_BILL_VIEWS.md) is implemented from sales and grouped sales reports with user-confirmed UAT passed; [Daily sales access and receipt copies](docs/49_DAILY_SALES_RECEIPT_COPY.md) are implemented; PromptPay checkout and physical-printer UAT remain pending. UI uses the shared white/blue reference theme with responsive sidebar, square POS cards and dark mode; see [theme QA](design-qa.md) and the [modern design system](docs/32_MODERN_UI.md). See [Web authentication](docs/21_WEB_AUTH_IMPLEMENTATION.md). Identity migration `202610110001_identity_tenants.sql` was applied to the confirmed development Supabase project on 2026-10-12. Remote table RLS/grants and bootstrap function permissions were verified; no organizations or test accounts were created during migration verification. The user subsequently confirmed signup, email verification, login and owner/store details. SQL/RLS tests run on isolated PGlite PostgreSQL with an Auth shim; they do not prove multi-connection concurrency. See [identity test evidence](docs/20_IDENTITY_IMPLEMENTATION.md).

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

[POS Print Agent](docs/55_PRINT_AGENT.md) adds local printer pairing, default/named printer selection, automatic receipt submission after confirmed checkout, content-sized 58/80mm receipts and Windows/macOS installer links in store settings. Physical printer and OS installation UAT remain required.

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

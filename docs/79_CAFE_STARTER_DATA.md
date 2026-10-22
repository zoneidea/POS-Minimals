# Cafe starter data

## Owner experience

After successful shop creation in CAFE mode, the owner can preview, apply the starter package or choose an empty shop. RETAIL onboarding retains its existing flow. ReservePay contact-sync warnings remain independent of the starter decision. No shop is seeded automatically by deployment, changing modes or opening Products.

The Products page shows the package panel only in CAFE mode. An existing cafe without a package decision can also preview/apply it. APPLY and SKIP are one-time, persisted decisions for `cafe-starter-v1`. Once cleared/skipped the package cannot be reinstalled through this version; shop-created or retained records remain editable normally. A failed transaction creates no decision and can be retried. Repeated requests return a stable state without duplicates.

## Package

4 categories, 18 cold-drink products, 7 reusable option groups (size, sweetness, ice, espresso shot, syrup, whipped cream, jelly). Each menu has suitable assignments; soda does not inherit coffee shots or a misleading 0%-sweetness choice. Whipped cream and jelly are separate groups to avoid offering inappropriate toppings. Default size/ice are normal and sweetness is 100% normal; paid extras have no default selection.

Prices in the authoritative SQL manifest are editable starting prices, not a verified market median: coffee 50–65 THB; tea 35–60; milk/cocoa 40–50; soda 40. Products have no image, no opening stock and `track_stock=false`. The legacy nonempty barcode constraint is fulfilled by a unique internal `CAF-<uuid>` item code; no manufacturer/scanner barcode is invented. Cost starts at zero, with a clear onboarding/preview warning to set real costs before interpreting profit reports.

## API contract

Owner-only JWT-authenticated same-origin endpoints:

- `GET /api/v1/management/cafe/starter` → `{status, remaining, catalog}`. Status is AVAILABLE, APPLIED, SKIPPED or CLEARED. `remaining` counts active package-origin products/categories/groups, including retained customizations. Catalog includes version/categories/products/groups and their assignments/options. It comes from the server; no client-supplied menu data is trusted.
- `POST /api/v1/management/cafe/starter` with strict `{action:'APPLY'|'SKIP'|'CLEAR', packageVersion:'cafe-starter-v1'}` → status and applicable counts (`created`, `skipped`, `removed`, `kept`, `categoriesCreated`, `groupsCreated`, `categoriesRemoved`, `groupsRemoved`). Removed/kept refer to products. No org/user ID accepted. Tenant is derived from the active owner membership in both API and database.

Success envelope `{success:true,data}`; errors use existing error/request-ID envelopes. 400 invalid input/version; 401 no JWT; 403 nonowner/inactive; 409 cafe-mode/group-limit conflict; 503 database unavailable. CLEAR is allowed after changing to RETAIL through the API, so it is not tied to an impossible cafe-only cleanup state; the UI panel itself remains cafe-only. Version mismatches do not install another package.

Existing checkout/quote, catalog, product/category/option management and bootstrap request/response contracts are unchanged. Canonical/mirrored OpenAPI and generated clients describe the new routes. Starter mutations invalidate Node cache and await existing shared category-cache invalidation before responding.

## Storage and preservation

Migration `202610220006_cafe_starter.sql` is additive and auto-discovered by DatabaseInitializer. It installs private server-owned catalog/RPCs plus org-scoped provenance and decision tables with RLS and no direct authenticated/anonymous/service-role table grants. No shop business rows are populated by migration. Public RPC execute is granted only to authenticated users; live owner checks run inside each RPC. No new sensitive contact fields or secrets are stored.

Product/configuration edits and option assignments mark package provenance as customized. The mark persists after an edit is reverted. Ordinary sale stock/version/timestamp updates do not mark menu configuration as edited. APPLY reuses existing category names without taking ownership and skips existing active product names without altering them. A shared group is preserved if an active product still references it. The shop retains ownership of its pre-existing categories and menus.

CLEAR soft deletes only unchanged package products with zero on-hand quantity. Customized products and any remaining physical stock are retained. It soft deletes unused, unmodified package categories/groups/options; rows used by retained/custom products remain. No sales, sale items, receipt/option/cost snapshots, payment records, stock ledgers or audit history are physically deleted. Package status changes to CLEARED atomically with cleanup; repeated cleanup is a no-op. Standard product audit rows and package-level activity events are appended for apply/skip/clear. Request/response logs retain metadata only, without payloads or credentials.

Mutations lock store mode, existing product rows and categories before the shared cafe configuration advisory lock. The per-shop package decision is serialized with that lock. Any error rolls back categories, products, options, provenance, decision and audit rows together. Real multi-connection concurrent load testing remains separate from PGlite's single-connection proof.

## Verification and release

Automated DB/RLS coverage includes owner/staff restrictions, another shop remaining untouched, retail rejection, one-time apply/skip/clear, strict provenance permissions, default assignments and cash checkout of untracked seeded products, unchanged historical receipts after cleanup, retention of customized/shared data, existing same-name product/category protection, and full rollback on a deliberately injected mid-import failure. HTTP tests cover authentication, both nonowner roles, allowed commands, version/tenant/catalog forgery rejection and unsuccessful conflict envelopes.

Browser QA uses actual React onboarding/Products/preview components with isolated fixture responses; it creates no hosted shop, sale, category or product. Live shop owner acceptance remains separate. Keep the additive database objects during an application rollback; the previous API safely ignores them. Do not drop provenance or edit an already applied migration to roll back an individual shop's data.

Release preparation on 2026-10-22: local typecheck/build and 64 available test files / 227 tests pass; subsequent focused preservation/rollback/name-collision/optional-stock checks pass. The additive migration was applied to the previously confirmed development Supabase target; both new tables have RLS and deny direct authenticated INSERT, anonymous RPC execution is denied, and package decision count remained zero. Desktop/mobile light/dark fixture QA covers preview, apply, confirmation cancellation, clear, skip and unchanged RETAIL onboarding. No real shop was seeded or cleared by the agent.

CI fixture timing: the initial hosted run passed 506 tests and timed out only in the new starter integration test while initializing PGlite and all migrations under the default 5-second test budget. Migration/WASM setup now runs in a dedicated beforeAll hook (30-second limit); behavioral assertions retain a separate 10-second integration-test budget and all existing assertions. Application runtime and migration are unchanged by this test-only repair.

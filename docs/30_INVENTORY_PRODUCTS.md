# Inventory products — 2026-10-12

## Implemented slice

OWNER inventory at `/inventory`: real Supabase data, DataTable with ten rows per page, barcode/name/category/quantity/cost/sale price, low-stock and out-of-stock states, create/edit Modal and soft-delete confirmation Modal. Cancel sends no mutation; errors remain inside the Modal and writes are never automatically retried. Edit/delete require the version loaded with the product. Categories are loaded across API pages; failures block saving until a successful retry. Inputs and selects are flat with visible focus styles; mobile scroll stays within the table.

New products start with stock zero. This slice intentionally does not permit stock edits in the metadata form. Stock adjustments/movements, image upload, Excel import, search, employee POS catalog and audit reverse/UI remain subsequent tasks. No fabricated product images or stock values are shown.

## API contract

Bearer JWT and fresh active OWNER membership are required for every inventory request. All calls use same-origin `/api/v1` routes.

- GET `/inventory/products?page=1&limit=10`: `{items,total,page,limit}`; bounded page and limit; active rows only, server-derived tenant.
- POST `/inventory/products`: `{barcode,name,categoryId,salePrice,unitCost}`; categoryId is UUID or null; prices are decimal strings (up to twelve integer digits and two decimals), default UI input `0`.
- PATCH `/inventory/products/:id`: the same fields plus `expectedVersion`.
- DELETE `/inventory/products/:id`: `{expectedVersion}`; soft delete exclusively.
- Mutation response: `{id,barcode,name,categoryId,salePrice,unitCost,quantity,version,imagePath}` inside the standard `{success:true,data}` envelope. Price responses use two decimals; imagePath is currently null.
- 400 invalid input/category; 401 missing/invalid session; 403 non-owner; 404 missing/cross-store ID; 409 barcode duplicate/stale version; 503 provider unavailable. No client org_id or quantity/image mutation is accepted.

Canonical OpenAPI and generated TypeScript record types updated. Existing planned catalog schema is preserved separately; full inventory costs are never exposed through employee access.

## Database and history

Migration `202610120002_products.sql` adds tenant products and append-only product_audit_logs, owner-only SELECT policies, indexes, composite org/category FK, and `manage_product` RPC. The RPC derives organization from active OWNER membership and keeps mutation, before/after snapshots, version increment and activity audit in one transaction. Direct authenticated writes and anonymous RPC calls are denied. Category attachment takes a shared lock while category deletion takes an exclusive lock and checks active references.

Barcodes preserve leading zeros, are trimmed and remain unique within each org including soft-deleted rows. Deletion records deleted_at/deleted_by; product and audit rows remain stored. No quantity is changed by metadata mutations. Product monetary fields use NUMERIC(14,2); no business totals are computed with floating-point arithmetic.

Migration applied to the confirmed development Supabase. No user-store test products were inserted by the agent. To recover from rollout issues, disable the inventory route/UI while retaining schema and audit history; never roll back by dropping business tables.

## Verification

TypeScript, 116 automated tests and production build pass. PostgreSQL tests cover two tenants, owner/non-owner/anonymous access, duplicate barcode including deleted products, category reference guard, version conflicts, audit before/after history and transaction rollback on audit failure. Isolated PGlite tests do not prove multi-connection concurrency. Hosted RLS/grants verified separately; Local rendered interaction and actual create/edit/delete remain user UAT.

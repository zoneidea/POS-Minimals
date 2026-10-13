# Excel product import — 2026-10-12

OWNER-only `/inventory` → Import Excel Modal → Download Template → select `.xlsx` → preview rows/errors → confirm all-or-nothing. Shared DataTable shows ten rows per page, internal scrolling, desktop/mobile and existing light/dark theme. No existing product is updated; duplicate barcodes (including soft-deleted records) are rejected. Images remain a separate optional upload.

## File format

Use the `Products` sheet with exactly these six headers: `barcode,name,category,salePrice,unitCost,quantity`. `Instructions` sheet explains the format. Template contains no fake business rows. Barcode/name/category are text; barcode must be a Text cell to preserve leading zeros. Blank category means no category; otherwise exact existing category name in this shop. Prices/costs are nonnegative decimal strings or numeric cells, up to 12 integer digits and two decimal places; no rounding of excessive precision. Quantity is a nonnegative integer up to 2,147,483,647. Maximum 1,000 rows and 5 MiB. Formula/rich-text/link/error cell objects are rejected instead of trusting cached results. No remote URLs/images are fetched.

ZIP validation bounds archive entries (200), compressed size (5 MiB), each actual inflated entry and cumulative decompressed data (20 MiB); rejects encrypted ZIP, duplicate/traversal entry names, VBA and external-link entries before ExcelJS parsing. ZIP64/multi-disk archives are unsupported. ExcelJS is the existing server-only workbook library; multer adds bounded multipart parsing after authentication/OWNER verification. npm audit reports zero vulnerabilities.

## API and database

All requests use same-origin Bearer JWT and active OWNER membership. No client org ID determines authorization.

- GET `/api/v1/inventory/import/template`: XLSX download.
- POST `/api/v1/inventory/import/preview`: multipart `file`; returns standard success envelope with `{batchId,expiresAt,rows,errors,status,importedCount}`. Parser errors identify actual Excel row numbers. `rows` contains valid normalized rows; `errors` contains validation/database conflicts. Preview creates a private batch but no products, stock or business audit. Any error marks the entire batch INVALID.
- GET `/api/v1/inventory/import/:batchId`: inspect/recover batch result for its creator in the active shop.
- POST `/api/v1/inventory/import/:batchId/commit`: empty JSON `{}`; locks batch, rechecks owner/shop, expiry, category availability/name and unique barcodes; returns COMMITTED result. Client cannot replace preview content. Same batch retry returns immutable original result without duplicating products/logs.
- 400 invalid JSON/ID; 401 unauthenticated; 403 non-owner; 404 unavailable/cross-shop/cross-actor batch; 409 changed/expired/invalid batch or duplicate barcode; 422 invalid file; 503 database unavailable.

Migration `202610120013_inventory_import.sql` adds private, RLS-enabled batch storage with no authenticated/anonymous direct access. Fixed-search-path SECURITY DEFINER RPC derives membership itself and validates row fields even for direct authenticated RPC callers. Existing product uniqueness and shared category locks arbitrate concurrent master edits. All inserts, IMPORT product audit, IMPORT_INITIAL stock movements (positive initial stock only), activity log and committed result are one transaction. Zero initial stock creates product/audit without a zero-delta movement. History is never deleted. Default preview lifetime is one hour; committed results remain retrievable after expiry. Uncommitted batches are retained; automated retention is not implemented.

Before POST commit, the client persists only pending batch ID under a user-scoped localStorage key. Network/response ambiguity blocks selecting a new file until GET recovery; the batch ID survives refresh/modal close. GET first, then explicit same-batch confirmation if still READY. No automatic mutation retry or new idempotency identity. Existing cart/session behavior is unchanged.

## Verification and acceptance

231 automated tests pass, including 15 import cases: real XLSX reopening, 30 rows/leading zeros, numeric barcode/formula/duplicate/amount/quantity errors, authenticated multipart bounds, OWNER/cross-shop checks, private batch access denial, expiry/category changes, once-only replay, rollback on post-preview duplicate or audit failure. Typecheck and API/Web build pass; existing bundle-size advisory remains. PGlite tests are isolated single-connection PostgreSQL, not concurrent hosted load proof.

Migration applied to confirmed development Supabase. Live browser preview of 30 explicitly named QA rows succeeded; no QA product commit was performed in the user's store. User must verify real-file commit, initial quantities and duplicate re-import rejection before marking import UAT Pass.

Dashboard/report UAT is user-confirmed Pass. No Supabase region change was made. PromptPay checkout and receipt printing remain separate subsequent work.

User subsequently confirmed real-file Excel import UAT Pass, including the requested stock/duplicate checks.

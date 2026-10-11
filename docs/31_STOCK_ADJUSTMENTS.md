# Stock adjustments and retained history — 2026-10-12

## Workflow

OWNER opens the stock-adjust icon on an inventory row. Modal shows current quantity, signed delta (initial 0), resulting quantity and required reason. Save rejects zero/fractional changes and negative or overflowing resulting stock. After success inventory reloads from the server. Quantity is never edited through generic product CRUD.

The inventory toolbar opens all stock history; each row also opens product-specific history. Both use the shared Modal and DataTable, ten records per page, newest first. Columns include update time, product/barcode snapshot, before quantity, delta, after quantity, reason and actor. Actor UUID is retained permanently; current display username is optional and can change. Display times use Asia/Bangkok; stored timestamps use PostgreSQL timestamptz. History remains accessible after product soft-delete. Metadata CRUD also keeps quantity, version, actor and time in existing product audit snapshots.

## API contract

Bearer JWT with active OWNER membership is required; tenant context is resolved afresh. Backend never accepts org_id, before/after quantity, actor or time from the client.

- POST `/api/v1/inventory/products/:id/adjust-stock`: `{delta,reason,expectedVersion}` and mandatory UUID `Idempotency-Key`; standard success envelope with InventoryProductRecord.
- GET `/api/v1/inventory/stock-movements?page=1&limit=10&productId=<optional UUID>`: standard envelope `{items,total,page,limit}`. Each item `{id,productId,productName,barcode,delta,before,after,reason,actorUserId,actorUsername,updatedAt}`.
- 400 invalid input/key or overflow; 401 unauthenticated; 403 non-owner; 404 unknown/deleted/cross-store product; 409 stale version, insufficient stock or reused key with different payload; 503 provider unavailable.

The Modal preserves one idempotency key across retries; writes are not automatically retried. Same key/payload returns the committed response without another adjustment or log. Changing the payload after an ambiguous result requires closing and reviewing current stock; key reuse with a different payload is rejected.

## Database and security

Migration `202610120003_stock_movements.sql` creates stock_movements and adjust_product_stock. The RPC derives the owner org, serializes by tenant/key, locks the product row, validates expected version/nonnegative quantity, increments product version and atomically writes the stock movement, product before/after audit and activity log. Any audit failure rolls back the entire operation including idempotency storage. All successful adjustments preserve quantity_before, quantity_after, quantity_delta, performed_by, created_at and reason. Failed HTTP requests retain existing safe request/response metadata logs; they do not create successful movement records.

Ledger tables are append-only to ordinary authenticated callers: no direct INSERT/UPDATE/DELETE privileges. RLS allows OWNER reads only and hides other tenants. The movement stores product name/barcode snapshots and retains the actor UUID; no email/name/token or secrets are newly stored in these records. Secrets remain server-only. Product soft-delete never removes stock/audit history.

Applied to the confirmed development Supabase. Hosted RLS, direct-write denial and anonymous RPC denial verified; no test products or adjustments were inserted into the user's store. Future sale/void/import transactions must append their own compatible movements rather than updating stock directly.

## Evidence and limits

135 automated tests and TypeScript/build pass. Added HTTP role, payload, tenant and idempotency checks; isolated PostgreSQL before/after/time/actor/reason, nonnegative stock, stale version, replay, ledger RLS, soft-delete retention and audit rollback tests. PGlite uses one connection; concurrent connection/load proof remains pending. Browser verified the actual hosted empty history, loading/empty states and open/close at desktop/mobile. User-store stock adjustment awaits UAT after a product is created.

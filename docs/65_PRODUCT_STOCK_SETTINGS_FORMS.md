# Product opening stock and settings forms

## API contract
- POST `/api/v1/inventory/products`: adds optional integer `initialQuantity` (0–2147483647), default 0. Existing payloads remain valid. PATCH rejects this field; subsequent stock changes use the adjustment endpoint.
- Positive opening quantities use `create_product_with_stock` to call existing owner-authorized product creation and stock adjustment routines in one database transaction. Product creation, before/after stock movement, timestamp, actor, and audit all commit or roll back together. Initial zero stock is captured in the product creation audit.
- POST `/api/v1/inventory/products/{id}/adjust-stock`: `reason` may be omitted, empty, or whitespace; omitted/whitespace becomes an empty string. Maximum remains 500 characters. Quantity/version validation, tenant/owner authorization, negative-stock protection, audit, and idempotency are unchanged.
- Migration `202610150005_initial_product_stock.sql` changes only the reason check/function and adds an authenticated-only creation RPC. Applied migrations remain unchanged. Deploy migration before the application. Existing records remain intact. Rollback application first; retain additive RPC and permissive reason constraint to preserve existing empty reasons.

## UI
Product creation includes opening quantity (default 0); product editing cannot directly rewrite stock. Adjustment reason is optional. Invite action aligns right. ACCOUNTANT displays as บัญชี; internal role codes remain unchanged. Store settings show PromptPay then printer as separate side-by-side panels on wide screens and stack on narrower screens. Required markers are inline after label text; VAT checkbox aligns vertically with its neighboring input.

Username/profile and email-free account creation are deferred per user instruction; authentication remains unchanged.

## Validation
Isolated PostgreSQL tests cover opening quantity/audit, rollback of product creation if stock fails, ownership/tenant denial, empty reason persistence, and idempotent replay/conflict. Browser fixtures exercise responsive forms without creating production business records.

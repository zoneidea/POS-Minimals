# Owner sale cancellation and stock restoration

## Implemented scope

`/sales` is an OWNER-only sale list with ten-row DataTable pagination, refresh/loading/error/empty states, status and cancellation deadline. The confirmation Modal requires a trimmed 1–500 character reason. It states that actual cash/bank refund is handled outside the app (D15). Only cancel a COMPLETED sale within 24 elapsed hours of completed_at UTC (D04). The database wall clock is authoritative; the UI deadline is a convenience.

Changing menus, including the newly registered `/sales` route, uses history navigation and preserves the authenticated workspace. A hard browser reload still performs initial authentication. No login/token/role cache is introduced.

## API contract

- `GET /api/v1/sales?page=1`: OWNER, Bearer JWT, fixed limit 10, verified org filter and RLS. Response `{success:true,data:{items,total,page,limit:10}}`; item includes id, saleNo, status, totalAmount, completedAtUtc, voidDeadlineUtc, nullable voidedAtUtc and voidReason. No cost/identity ciphertext or checkout request payload is returned.
- `POST /api/v1/sales/:id/void`: OWNER, Bearer JWT; body `{reason}` only. Response `{success:true,data:{saleId,status:'VOIDED',voidedAtUtc,replayed}}`. Sale ID is the operation identity; retries with the same trimmed reason return the original result without restocking twice, even after the window. A different reason for an already-voided sale returns ALREADY_VOIDED (409).
- Errors: 400 validation; 401 unauthenticated; 403 role denied; 404 same-shop sale missing; 409 VOID_WINDOW_EXPIRED/ALREADY_VOIDED/STOCK_LIMIT_EXCEEDED; 503 unavailable/ambiguous result. Unknown query/body tenant fields are rejected. Canonical OpenAPI and generated client types updated.

The Modal retains the attempted reason after submission, allowing a same-operation retry following an ambiguous connection failure. Closing reloads the list. A rejected/ambiguous result never claims cancellation succeeded. It does not perform a financial refund.

## Database and audit

Additive migration `202610120008_sale_void.sql` was applied to the confirmed development Supabase. Prior migration checksums are unchanged. Sales gain voided_at, voided_by, void_reason. Owner-readable, direct-write-denied `sale_void_logs` retains actor, reason, timestamp, request ID and before/after status; other roles/tenants cannot read it.

The RPC derives the active owner/shop from Auth, locks the sale, checks UTC wall clock after lock acquisition, locks affected products in stable ID order, then rechecks the deadline. It restores the original SALE_OUT quantities against the latest stock, including products later soft deleted, and bumps versions. Every restoration appends SALE_VOID_IN with before/after quantities, actor/time/reason and sale linkage, product REVERSE audit and SALE_VOIDED activity. Sale status change and all logs commit atomically. A partial unique movement index plus locked VOIDED status prevents duplicate restoration. Integer stock/version limits return a conflict and roll back.

Sale lines, cash payment and original result/receipt snapshots are retained unchanged; the current sales row/list carries the VOIDED status. No physical deletes and no rewriting original cash payment into a refund. Forward rollout is additive; to disable this feature, unmount owner management routes/menu and revoke void RPC execution rather than deleting financial or audit history.

## Verification and limits

195 automated tests across 25 files pass, plus typecheck and API/web production build. Added tests cover owner/non-owner/anonymous HTTP gating, validation, cross-shop denial, repeated void, changed-reason conflict, latest-stock restoration, soft-deleted product retention, immutable sale/payment snapshots, direct audit write denial, expired/near-deadline UTC window and rollback when activity logging fails. Existing checkout/quote/storage/identity tests pass. PGlite is single-connection; real concurrent checkout/void load tests remain pending.

Local IAB: desktop 1280×720 and mobile 390×844; real shop sale list loads; Modal opens/closes with reason required and responsive textarea. POS → sales → inventory → sales preserves the workspace; a temporary dark-theme state remained across menu navigation. No console errors after the fix. No live sale was cancelled and no cash refund was issued during agent UI verification. At implementation time, user live cancellation/restock UAT was pending; see subsequent acceptance below. Existing Vite bundle size warning remains.

Earlier failures resolved: unordered test-result comparison and missing TypeScript result type, cleanup of the simulated log-failure constraint in finally, migration initializer expected-list update, and API runtime schema imports outside rootDir. Runtime schemas now remain within each app; frontend DTO type comes from generated contracts, preserving existing build structure.

Next requested item is store settings/staff management; it has not been started in this change.

## User acceptance — 2026-10-12

The user confirmed a real sale was cancelled successfully and stock was restored. Live cancellation/restock UAT is **Pass**, based on user-reported testing. No additional live cancellation was performed by the agent. Multi-connection concurrency testing remains pending.

2026-10-13 user-directed rule update: cancellation is limited to the same Asia/Bangkok calendar sale day, replacing the rolling 24-hour rule. Rechecked under both sale/product locks; replay remains idempotent. See 49_DAILY_SALES_RECEIPT_COPY.md.

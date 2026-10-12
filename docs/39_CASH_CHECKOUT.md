# Atomic cash checkout and result recovery

Implemented `POST /api/v1/sales` and `GET /api/v1/sales/by-idempotency-key/:key` for active OWNER/EMPLOYEE membership. Cash only; PromptPay remains pending. The Checkout Modal enables confirmation only with a usable fresh quote, accepted changed prices, nonempty cart and sufficient valid received cash.

## Transaction and storage

Migration `202610120006_cash_checkout.sql` creates sales, immutable line snapshots and cash payments. It adds sale linkage to stock movements and the SALE_OUT audit action. DatabaseInitializer applies this additive migration; previous migration checksums remain unchanged.

The RPC derives organization/actor from Auth, validates the request independently, serializes by organization+idempotency key, locks products in stable ID order and locks store settings while calculating. It recomputes price/stock/discount/inclusive VAT and compares expected prices, versions and total. A single transaction writes sale, payment, line snapshots, stock movements, product before/after audit and activity event. Any failure rolls everything back. Stock remains nonnegative. Discount allocation uses cumulative integer-cent rounding with the final remainder, including zero-price lines, so line net amounts sum exactly to the bill.

Same key+same request+actor returns the original committed result (HTTP 200); first commit returns 201. Changing a request under an existing key returns 409. Replays preserve the original product/payment snapshots after master edits. The fingerprint from quote is not a reservation; transaction validation remains authoritative.

Sales/payment direct writes are denied by grants/RLS. OWNER can read shop sales; EMPLOYEE can read own sales/payments, with no access to cost-bearing sale_items. Recovery explicitly filters verified shop and relies on RLS for caller access. ACCOUNTANT, anonymous, inactive and other-shop callers cannot commit/recover outside their permissions.

## Identity encryption

Snapshot store/cashier names are AES-256-GCM ciphertext in the database. The API derives them from verified identity context, encrypts before RPC and decrypts only allowed results for display. Random nonce, authentication tag and versioned AAD are used. Ciphertext is omitted from API results. Product/price/quantity snapshots retain normal business columns under tenant access controls. No passwords, Auth tokens or payment credentials are stored in sale input.

`SALE_SNAPSHOT_KEY` is a required server-only 32-byte hex key. A development key was generated into ignored `.env.local`; it is never printed or committed. For another environment generate and configure a separate secure key, back it up with database recovery materials, and retain it while encrypted history exists. Key rotation/version management is not implemented; replacing the key blindly makes existing identity snapshots unreadable. Full receipt address/phone/tax/footer settings snapshots are not implemented in this slice.

## Client recovery

The immutable request and UUID key are saved in a user+shop-scoped local draft before POST; inability to save prevents submission. While a request is busy/ambiguous, payment inputs and closing are blocked and the recovery action remains available. Recovery GET is performed first; only 404 allows re-sending the exact same POST/key. Recovery unavailability does not cause a new POST. A new key is never generated for an ambiguous result. Known validation/permission/conflict failures let the user review again.

The cart clears and catalog reloads only after a validated COMPLETED response/recovered result. The Modal then displays immutable receipt rows and totals. Received/change calculation remains decimal-safe. The displayed receipt is a basic committed-result preview, not the finished 80mm print/history module. Actual print and `GET /sales/:id/receipt`, sales listing/void/reporting remain pending.

Stock history now includes SALE_OUT events with bill reference, before/after quantities, timestamp and actor. Labels use general stock-history wording.

## Bug fix and evidence

The initial SQL failure came from `p_input->'payment' - array[...]`: subtraction bound before JSON extraction. Explicit `(p_input->'payment')` fixes the parser precedence. The failing transaction test now passes.

177 tests across 21 files pass with typecheck/build. SQL tests cover two-product atomic checkout, zero-price/discount allocation, payment/movement creation, duplicate replay/conflict, stale versions, insufficient payment, two-shop/role restrictions, immutable results and full rollback when the activity log fails. AES tests verify randomized ciphertext, correct decryption and authentication failure for tampering/wrong keys. Client tests verify status-before-retry, exact body/key reuse and no POST on recovery failure.

PGlite tests are isolated and single-connection: they do not prove real multi-connection race throughput. Hosted development migration and empty-store UI checks do not prove a completed live cash sale. No test products/payments were inserted into the user's shop. At implementation time, populated hosted cash and ambiguous-network UAT were pending; see subsequent user acceptance below. Real multi-connection concurrent checkout testing remains required before production.

## User acceptance — 2026-10-12

The user reported **Pass** for complete cash checkout with real data, including stock changes and network interruption. These live functional UAT items are accepted. This records the user’s test result; the agent did not repeat a live sale or obtain test logs in this update. It does not establish multi-connection concurrency or production readiness.

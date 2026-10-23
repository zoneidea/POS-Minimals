# Table transfers and browser-local parked bills

## Restaurant table transfer

Owner/employee selects an open table from the floorplan, chooses **ย้ายโต๊ะ**, selects another enabled/free table and confirms. The same bill ID, rounds, prices, guest QR and payment identity remain. Source becomes free; destination becomes occupied. Existing guest QR follows the bill and displays the new table name on refresh. Previously printed paper is not changed or automatically reprinted. Pending cash results must be resolved before initiating a move. Unsaved order drafts remain scoped to the original bill ID.

`POST /api/v1/restaurant/bills/{id}/move` uses the normal staff Bearer token and strict JSON `{targetId: UUID, version: positive integer, key: UUID}`. Response is the standard success envelope with `RestaurantBill`. No organization or prices are accepted from the browser. Accountant is denied. Same-table input is invalid; unavailable/occupied target, stale version and closed bill are rejected. Existing error envelopes apply: 400/403/404/409/503.

Migration `202610230008_restaurant_move_table.sql` adds a single RPC and a private org-scoped move-request ledger. It reuses the existing settings → org operation lock → bill → table lock order, the one-open-bill unique index and activity/management audit tables. A repeated key/body returns the current original bill and never re-executes a completed move; key reuse with another body conflicts. Audit metadata contains source/destination IDs only. No stock movement, payment or sale is created. Functions are unavailable to anon and nonmembers. Private ledger grants are revoked for all client roles. Existing RPCs and schema fields are unchanged.

Apply using the existing `DatabaseInitializer` after confirming the documented database target. Old clients remain compatible after applying the migration. Rollback UI/API first; retain the move ledger/audits and current table assignments rather than undoing completed customer moves.

## Retail/cafe parked bills

The owner chose **same machine/browser and same logged-in user only**. Buttons **พักบิล** and **บิลที่พัก (N)** appear at the cart. Parking retains all items, quantities, cafe option snapshots and notes, then clears the active cart. Recall is allowed only with an empty active cart and removes the parked entry in the same write. Discard requires confirmation. Maximum 50 parked bills. No stock reservation, sale, payment, queue number or receipt is created at parking; normal server quote/checkout validation runs on recall and payment. Checkout discounts/coupon/payment inputs are not parked because parking takes place before Checkout.

A new `pos:parked-workspace:v1:{userId}:{orgId}` browser key stores active cart and parked entries together with a revision. Existing active carts are imported from the old cart key, whose active-cart mirror remains readable for older code; the workspace is authoritative for this Web POS. A single `localStorage.setItem` commits parking/recall atomically. Stale revision, corrupt storage and quota/denied writes fail without acknowledging success or replacing the original state. Cross-window storage events refresh the workspace, but this is not a transactional multi-terminal order system; use one active POS window for a cashier's local draft. Guest and restaurant composer cart hooks retain their original implementation. No API or database payload is added for parked bills.

Any stored cash/Gateway pending marker, including unreadable contents, blocks park/recall/discard until the original payment is resolved. Parked data survives reload/day boundaries but does not sync to other devices and will be lost if browser storage is cleared. Existing inactive memberships/session checks still apply to payment. Browser diagnostics retain only action/time/count, up to 100 records and at most 30 days, without item/notes/contact data. No customer identity field is introduced.

## Verification

- Restaurant HTTP tests: staff authentication, owner/employee vs accountant and strict payload.
- PostgreSQL tests: free/occupied/disabled/foreign target, stale version, replay/conflicting key, same bill/rounds and QR preservation, one audit event and source/destination status.
- Parked cart tests: legacy import, reload, scoped isolation, option/note preservation, atomic recall, active-cart protection, stale/corrupt/quota failures, pending payment and limit guards.
- Browser QA uses isolated simulated stores/printers; no live shop order is created for UI testing. Real-device acceptance of these two new flows remains separate from the prior accepted cafe/restaurant modes.

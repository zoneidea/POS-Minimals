# Gateway contact recovery and local cancellation — 2026-11-06

## Bank save

Before linking a saved bank account, the owner-authenticated backend verifies the store's external contact ID against the current ReservePay account. An old local SENT contact record is not evidence that Production contains the contact. A verified NOT_FOUND creates the contact using the stored shop name, encrypted phone and authenticated verified owner's email, then retrieves it again before bank linking. Authorization/network/mismatched-reference errors do not create contacts blindly. API credentials are included only in the protected fingerprint, never in logs or responses; fingerprint includes holder name and account details so unrelated account attempts do not reuse old results.

The latest affected store's contact was recovered in Production. The subsequent bank-link attempt returned HTTP 500 UNHANDLED_ERROR from ReservePay; it is still not confirmed linked. No transfer or payout was initiated. Provider-side bank-link failure remains an external blocker; do not claim successful account setup solely because contact recovery succeeded.

## Local Gateway cancellation

The user requested that staff return cash instead of calling ReservePay void/refund. POST `/api/v1/sales/{id}/void` retains its existing payload and response. It now calls the authenticated `void_sale_cash_refund` RPC. This records `gateway_cash_refunds` and `GATEWAY_CASH_REFUND_DECLARED`, then invokes the existing atomic cancellation/restock transaction. The ledger is a staff cash-refund declaration, not provider refund evidence. Original provider payment ID, method and amounts remain in payment history. ReservePay receives no cancellation/refund call.

Only an active owner of the sale's shop can cancel; the existing same Bangkok-day rule, reason validation, exactly-once stock restoration, coupon restoration and rollback guards remain. Replaying the same reason returns the original cancellation; attempts to forge the cash ledger directly are denied. Existing verified external-void recovery remains supported for compatibility.

The sale list and confirmation dialog explain staff cash return. Cancellation removes the sale from normal net-sales reports as before; the ReservePay payment itself is still captured, so provider balance and settlement records will not show a refund. Financial reconciliation must account for the staff cash declaration.

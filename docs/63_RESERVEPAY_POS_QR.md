> Updated completion/report behavior: [64_GATEWAY_SALES_REPORT.md](64_GATEWAY_SALES_REPORT.md) supersedes the earlier init-only limitations below.

# ReservePay POS PromptPay QR

For Gateway-enabled shops, checkout replaces the unavailable PromptPay save action
with **สร้าง QRCode**. Uploaded static QR and cash checkout retain their behavior.

Flow: live POS quote → SDK selectPaymentMethod (THB, PROMPTPAY, integer satang) →
authenticated backend initiation → SDK discovery until DISPLAY_QR → retrieveQrData →
base64 decode QR text → local PNG generation with a four-module quiet zone.
SDK discovery continues in the background; a manual **ตรวจสอบการชำระเงิน** calls
checkStatus for the same session. Payment success is displayed as provider status;
it does **not** commit a POS sale, clear the cart, reserve stock or issue a receipt.
Completing paid sales/reconciliation remains separate work.

## API contract
POST `/api/v1/payments/gateway/initiate`, OWNER/EMPLOYEE only, active membership and
daily session policy enforced. Request: `{sessionId,items:[{productId,quantity}],
discountAmount,expectedTotalAmount}`. No caller org, merchant, key or account IDs.
Response `{success:true,data:{initiated:true}}` means initiation only.

Backend reads current shop Gateway mode without cached settings, recalculates the
cart with existing quote service and verifies total > 0. It retrieves the provider
session and verifies THB/PROMPTPAY/amount before using the server-only API key for
`/merchants/initiate-payment-flow`. Amounts use integer satang (44.01 THB → 4401).
The merchant API request has Api-Version 2025-04-01, capture true, configured public
return URL and deterministic `pos_<SHA256(sessionId)>` external_id for safe retries.
No provider response body, QR contents, secrets or raw session IDs are logged.
HTTP metadata continues through the existing request logger.

## Persistence and retries
Migration `202610150002_reservepay_payment_sessions.sql` adds service-role-only,
immutable session-hash bindings to org/user/cart/amount. Authenticated and anonymous
clients have no direct access. Cross-store/user/cart reuse is rejected before
provider initiation. Records are orchestration references, not sales/payment proof.
No destructive rollback is needed: disable this route/UI while retaining records.

Repeated QR retrieval or initiation uses the same session/external_id. Unknown
session-selection results disable automatic creation to avoid blind retries. Amount
and payment method edits are locked after starting; closing warns that QR remains
payable and does not cancel it. SDK discovery aborts on unmount or timeout; manual
status checks remain available. No automatic creation of replacement expired QR.

## Printing
**พิมพ์ QRCode** reuses paired Print Agent and selected/default Thermal Printer,
58/80mm. Without pairing, it opens browser print dialog. Output is a raster QR,
amount and a notice that it is not a receipt. No universal silent-print guarantee.

## Verification
Focused tests: amount conversion, raster generation, print escaping, live quote,
Gateway setting, authenticated role checks, session validation, stable provider
reference, timeout/error handling and SQL grants/unique session binding. Browser
fixture checks cash→PromptPay→create→QR→manual status with no console errors at
desktop and 390px width. Provider responses are mocked; no live charge/transfer or
physical printer test performed by the agent. User UAT must verify the installation
allows the deployed domain/PromptPay and scan/print the actual provider QR.

References:
- https://developer.reservepay.com/guides/accept-payments-using-your-own-ui
- https://developer.reservepay.com/api/sdk/select-payment-method
- https://developer.reservepay.com/api/sdk/retrieve-payment-session

## Cancel polling and expiry countdown
`ยกเลิกการชำระเงิน` asks for confirmation, aborts every active discovery runner,
hides QR/printing and blocks automatic replacement creation. This is a local stop
of waiting/polling; it does not revoke the provider QR, void or refund a payment.
The user can still check the original session manually. Payment-method edits remain
locked to avoid implying another method is safe before checking the prior payment.

The countdown reads `retrievePaymentSession.expires_at` (Unix seconds), updates from
wall-clock time every second and refreshes on focus/visibility to handle sleeping
tabs. No assumed TTL is invented if the provider returns null or the read fails.
At zero the QR/print controls hide and polling stops; the UI asks for a final manual
status check because payment may have completed at the deadline. A terminal provider
status also aborts all runners. Closing/unmounting invalidates in-flight QR work so
late responses cannot start new polling or render a cancelled QR.

Browser fixture verifies local cancel hides the QR and aborts both runners; expiry
reaches 00:00, hides QR and stops runners. No real provider cancellation is claimed.

## Payment reference retention and checkout controls
Migration `202610150003_reservepay_payment_id.sql` adds nullable unique `payment_id`
to session bindings. After initiation the backend validates the returned `pay_…`
string and persists it against the bound session/org/user before reporting success.
Repeated identical writes are accepted; a different reference cannot overwrite a
stored ID. Only service-role column updates are granted; browser access remains
blocked. Malformed provider responses or failed persistence return an error, and
retry uses the same external_id. Existing rows remain nullable; this does not
backfill historical payments or implement voids/sale completion.

Checkout controls run horizontally in print → cancel → check order, with compact
mobile labels. Checkout no longer shows the Gateway heading/settlement banner or
technical footnote. Cancel uses a short confirmation. Back to cart confirms stopping
the wait; closing unmounts the payment component and aborts active polling.

# Gateway sale completion and dedicated report

## User flow
For Gateway-enabled shops, Reports shows a **รายงาน Payment Gateway** link to
`/reports/gateway`. OWNER and ACCOUNTANT can view it; EMPLOYEE cannot. Current
shop configuration is checked by the API as well as the UI. Date pickers default
to today in Asia/Bangkok and accept an inclusive range of up to 366 days.
The API converts selected dates to `[from 00:00:00 +07:00, day after to
00:00:00 +07:00)`. Both rows and summary use this same half-open range based
on provider capture time, including fractional seconds through 23:59:59 and
assigning payments at or after midnight to the new day, regardless of server
timezone or when the bill is subsequently confirmed.

The table has bill number, payment_id, sale date/time, customer payment before
fees, actual payment fees, net after fees and cashier snapshot. DataTable shows
10 rows per page. Summary totals cover the whole selected range, not the current
page. Empty/error states retain filters, summary and table. Voided bills are
excluded. Net receipts describe payment less provider fees, not bank payout status.

## Verified completion
After SDK signals completion, or the cashier clicks Check Payment, POST
`/api/v1/payments/gateway/confirm` sends only `{sessionId}`. The backend derives
org/user from verified identity, reads the bound provider ID and calls ReservePay
`/merchants/find-payment` using its server-only API key. It validates ID, external
reference, THB, PROMPTPAY and exact integer-satang amount. Only SUCCESSFUL with a
capture timestamp permits sale posting. SDK status and caller-supplied proof are
never accepted as financial authorization.

Fees sum the returned `unit_amount` and `percentage_amount` for unique fees directly
attached to that payment. No fixed percentage is substituted. The provider
fee and paid timestamp are persisted before the authenticated posting RPC; unposted
proof expires after 60 seconds and must be reverified on retry.
Reference: https://developer.reservepay.com/api/merchants/find-payment

`complete_gateway_sale` locks the scoped session, serializes its idempotency key
and uses the existing cash transaction logic through a private Gateway core.
The public cash RPC is unchanged. Stock-only row-version updates are refreshed
under product locks; stock availability, price, discount and total remain checked.
A single transaction records sale/items, stock movements/audit, PROMPTPAY payment,
provider ID/fee/net, immutable receipt and session→sale link. Repeated confirmation
returns the same sale. Completed-at uses provider capture time.

If stock, price or settings changed incompatibly after payment, the transaction
rolls back and returns PAID_NOT_POSTED. Verified payment/reference remain retained;
do not collect again. Manual reconciliation is required for price/stock exceptions.
Gateway void via the local cash-void RPC is blocked until provider void integration
is implemented; the UI disables that action for PromptPay bills.

## Recovery and privacy
Initiation stores a server-computed checkout snapshot and encrypted store/cashier
identity. Per-user/shop browser pending storage retains session/amount/cart; opening
checkout after reload selects the existing Gateway attempt instead of a new cash
payment. Only a successful backend completion clears it; FAILED/EXPIRED can clear
the pending reference. A different current cart is preserved when an older payment
is completed. Closing/cancelling the UI stops polls without claiming provider void.

No webhook or unattended reconciliation job is added. After a closed browser,
return to the same user/shop and check the pending payment to post its bill. Legacy
sessions created before checkout snapshots were stored are not automatically
converted into sales. Existing cash records and snapshots remain unchanged.

## API/data contract
- POST `/payments/gateway/initiate`: existing payload/response; now also seals the
  server checkout snapshot before initiating the provider flow.
- POST `/payments/gateway/confirm`: OWNER/EMPLOYEE, original session user/org only.
  `{status, sale?}`; sale exists only after atomic posting. 409 PAID_NOT_POSTED keeps
  the original payment reference for review; 503 means status cannot be verified.
- GET `/reports/gateway?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1`: OWNER/ACCOUNTANT and
  current Gateway mode only. `{items,total,page,limit:10,summary:{gross,fees,net}}`.
  Each row includes `{id,saleNo,paymentId,completedAtUtc,gross,fee,net,cashierName}`.
- Migration `202610150004_gateway_sales_reports.sql` extends existing payments and
  session bindings, adds protected snapshot/verification fields, private posting
  core, authenticated completion/report RPCs and a Gateway guard in cash void.
  New fields have no direct authenticated writes. Financial snapshot data is
  retained; ordinary request/activity logs keep the existing 30-day policy.
- RLS/user-scoped report RPC derives org from current membership. API enforces
  feature visibility from encrypted shop settings. Service-role proof writes are
  scoped to session/org/user; raw provider customer data is not stored or logged.

## Verification and limits
Isolated PostgreSQL tests cover unverified/cross-store denial, one stock deduction,
replay, current stock version, rollback on changed price, accountant/employee access,
Thai midnight boundaries, provider ID/fee/net and cash-void prevention. Unit/HTTP
checks cover actual fee conversion, duplicate/mismatched provider data, backend
verification, posting errors and disabled-shop reports. Browser fixtures cover
calendar filtering, empty data, 10-row pagination, full-range summary, disabled
Gateway and Gateway confirmation→PromptPay receipt. No real charge is made by QA.
Live transfer, real printer and operational exception reconciliation require UAT.
Rollback: disable the new routes/UI; retain columns and verified financial records.

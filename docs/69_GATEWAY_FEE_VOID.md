# Gateway report fee and provider void

## Fee policy
`gateway_sales_report` calculates each bill fee as `round(amount * 0.015, 2)`
using PostgreSQL decimal arithmetic. Net is gross minus that fee; full-range
summaries sum the rounded per-bill amounts, independently of pagination.
Historical provider fees and immutable receipt snapshots are retained unchanged.
Example: 44.00 → fee 0.66, net 43.34; 1.00 → fee 0.02, net 0.98.
Voided sales are excluded. Bangkok half-open date boundaries remain unchanged.

## Cancellation contract
Existing `POST /api/v1/sales/{id}/void` still accepts only `{reason}`.
OWNER only; org comes from authenticated membership. A new cancellation must
start on the bill's Bangkok calendar day. Cash follows the original local void.
Sales rows add optional `gatewayPayment` (default false), true only for stored
provider payments while the shop is currently in Gateway mode. The UI enables
owner cancellation for those rows and retains confirmation and busy/error states.

`prepare_sale_void` validates live owner/org/sale/date and serializes a durable
60-second lease by org + sale. Its payment ID comes exclusively from the saved
payment row. An in-flight attempt returns 409; wait 60 seconds before reconciling
an unknown/failed request using the same reason. Changing that reason is rejected.
The backend verifies the current provider payment ID, amount, currency and method
with `find-payment`, then POSTs `/merchants/void-payment` with `{payment_id}`,
server-only Bearer key and Api-Version 2025-04-01. It requires JSON `true` and
rechecks status `VOIDED`. A previously VOIDED provider payment is recovered
without another void request. No provider response/body/key is exposed in logs.
Reference: https://developer.reservepay.com/api/merchants/void-payment

Only service_role can record provider evidence through `verify_gateway_void`,
scoped by org, sale, payment and current attempt UUID. Authenticated callers cannot
write the journal or forge evidence. The existing `void_sale` transaction refuses
Gateway restock without this proof and original reason, then restores stock once,
retains the payment, and appends stock/audit/void/activity history.
A verified cancellation can finish local recovery after midnight; this does not
permit starting a new cancellation for an old bill. API failures, non-voidable
settled payments, timeout or uncertain responses never trigger local restock.

## Operational limits
Provider and PostgreSQL cannot share one transaction. If provider success is
uncertain, keep the bill and reconcile the same payment, not a new payment ID.
If provider void succeeded but proof persistence failed at midnight, or local
stock limits prevent completion, retain evidence and reconcile administratively.
No automatic refund alternative is attempted when ReservePay refuses a void.
Lease/proof journal is financial evidence and has no 30-day application-log purge.
UI today's-only list does not expose older recovery attempts; those require API
reconciliation by an authorized owner.

## Release and rollback
Migration `202610160001_gateway_fee_void.sql` adds a protected financial journal,
updated/new RPCs and optional sales-row metadata. DatabaseInitializer
applies it before the API release; no historical payment values are overwritten.
Keep migration and evidence on rollback. Disable the new application flow if
necessary; the proof guard continues to prevent unverified local Gateway void.
Automated tests use isolated PostgreSQL and mocked ReservePay responses, with
role/tenant denial, lease expiry, stale proof, duplicate restock and fee rounding.
No real payment is cancelled by these tests; real provider cancellation needs UAT.

## Verification 2026-10-16
- Full isolated repository suite: 81 files / 414 tests passed (serial worker).
- TypeScript and production build passed; generated OpenAPI types refreshed.
- Migration applied to the user-confirmed development Supabase target.
- Live metadata: journal RLS enabled, authenticated writes/proof execution denied,
  service-role proof execution granted, report fee formula present.
- No real provider payment voided during automated verification. Live UAT pending.

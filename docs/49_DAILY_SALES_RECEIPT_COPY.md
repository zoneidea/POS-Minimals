# Daily sales and receipt copies

GET /api/v1/sales?page=N now permits OWNER and EMPLOYEE; service passes today-to-today Bangkok report bounds to the existing sale_bill_view RPC. Employees are additionally restricted inside the RPC to their own current-day rows, including totals/pagination. GET /api/v1/sales/:id/receipt permits employee own snapshots; other owners/shops or cashiers return NOT_FOUND. /sales/bills report lists remain OWNER/ACCOUNTANT. New `sales:read` permission only affects OWNER/EMPLOYEE menu visibility; cancellation still requires OWNER.

Void keeps the same endpoint and VOID_WINDOW_EXPIRED error but uses the same Bangkok calendar day, replacing the previous rolling 24-hour rule by user instruction. Current wall-clock checks occur after sale and product locks. Already-voided identical retries retain their original result without another restock. Deadline in list is next Bangkok midnight. Snapshot/ledger/encryption/idempotency behavior remains unchanged. Migration 202610130003 replaces the two functions, retaining grants; no table architecture change.

Bill Modal uses the immutable server receipt to open the browser print dialog for an 80 mm สำเนา. Every receipt item is printed regardless of Modal table pagination; names are HTML-escaped. Voided bills are marked canceled as well as copy. Dialog cancellation does not mean a physical print; no silent USB printing is claimed.

Sales report removes Dashboard-like metric cards; inventory report summaries remain. Header fixed at 80 px desktop /72 px mobile, matching application top offset. Report apply controls are compact and responsive.

Focused 75 tests passed before final validation: own/cross-shop bill authorization, owner-only void, past-day denial with unchanged stock, replay, full copy items and HTML escaping, and idle ranking. Hosted staff/store UAT and physical-printer UAT remain pending.

Final validation: full 254 tests /41 files, typecheck, build and diff check passed. Migrations 202610130002/003 applied to the confirmed development Supabase. Isolated Browser preview confirms employee sales navigation, no void control, receipt Modal and copy-print button. Physical printing and logged-in hosted UAT remain pending.

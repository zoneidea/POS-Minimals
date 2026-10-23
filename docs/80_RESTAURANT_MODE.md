# Restaurant mode — Phase 1 (2026-10-23)

## Delivered slice

An additive third `RESTAURANT` mode, chosen during provisioning or owner Store settings. Existing stores retain their mode. Staff-operated tables and cash settlement are the first release; guest QR ordering and PromptPay table settlement remain subsequent phases and are not advertised as available.

OWNER manages up to 100 uniquely named tables with zone, 1–100 seats and enable/disable. An occupied table cannot be renamed/disabled. OWNER/EMPLOYEE open one bill per table, send additional rounds, print preparation tickets immediately, and collect cash after dining. There is no kitchen/delivery status workflow. OWNER can cancel an entire sent round with a required reason; sent lines remain in history. An empty bill, or a bill with all rounds cancelled, can release its table without a sale.

## Contracts and authorization

All endpoints require the existing Bearer session, active membership and the daily session policy. Management routes also require OWNER. No request accepts `orgId`; SQL derives the tenant from `auth.uid()` and validates roles again. RLS permits scoped OWNER/EMPLOYEE reads, denies all direct writes, and denies ACCOUNTANT operational access. Private helpers have no client execution grant. Existing `/sales`, payment gateway and LINE SSO contracts remain unchanged; receipt metadata adds optional `restaurant: {billId, tableName}`.

| Endpoint, relative to `/api/v1` | Request | Result `data` |
| --- | --- | --- |
| GET `/restaurant/board` | none | `{tables:[{id,name,zone,seats,enabled,version,bill: Bill|null}]}` |
| POST `/management/restaurant/tables` | `{name,zone,seats,enabled}` | `{id}` |
| PATCH `/management/restaurant/tables/:id` | same plus required `version` | `{id}` |
| POST `/restaurant/tables/:id/open` | `{key: UUID}` | Bill |
| POST `/restaurant/bills/:id/rounds` | `{version,key,items:[{productId,quantity,expectedUnitPrice,lineId?,optionIds?,note?}]}` | Bill |
| POST `/management/restaurant/bills/:id/rounds/:round/cancel` | `{version,reason}` | Bill |
| POST `/restaurant/bills/:id/cancel` | `{version}` | Bill |
| POST `/restaurant/bills/:id/quote` | `{version,discountAmount,couponCode?}` | existing QuoteResult with server-owned bill snapshots |
| POST `/restaurant/bills/:id/checkout/cash` | `{version,key,receivedAmount,totalAmount,discountAmount?,couponCode?}` | existing CompletedSale, optional restaurant receipt metadata |
| GET `/restaurant/bills/:id/settlement` | none | original CompletedSale, or 404 if not settled |

Money is a decimal string with two fractional digits. Request keys are UUIDs. The round limit is 200 active lines and 200 rounds per bill; standard 200-line checkout applies. Bill contains `id,tableId,tableName,status,version,openedAt,totalAmount,rounds`. Each round contains immutable server-quoted items, number, timestamp and cancellation state/reason. Prices, modifier names/prices and notes are snapshotted when a round is confirmed. Browser totals/snapshots cannot override server values. If live prices changed from `expectedUnitPrice`, sending fails rather than silently charging another price. Each persisted line gets a unique ID across rounds.

Success: `{success:true,data:...}`. Errors use the existing `{success:false,error:{code,message},requestId}` envelope. 400 invalid input, 401 missing session, 403 role/tenant denied, 404 scoped record missing, 409 stale version/lifecycle/stock/idempotency conflict. GETs are no-store. Loading/error/empty and submission states are shown in Web; there are no blanket reload buttons.

## Transaction and inventory invariants

New migration `202610230001_restaurant_tables.sql` is automatically discovered by DatabaseInitializer. It adds tables, bills, rounds, indexes, RLS, scoped RPCs and mode-compatible food configuration; it never creates sample data or changes any existing shop mode. Existing migration files remain unchanged.

All restaurant mutations take the settings share lock, then a per-org transaction advisory lock; bill/product locks follow. The partial unique index is an independent backstop against two open bills for one table. Version checks reject a second terminal's stale order/payment. Mode changes lock settings first and are rejected while any table bill is open. Product deletion is rejected while active rounds reference it.

Open orders do not create sales, payments, stock movements or report revenue. **Stock is checked at send and deducted only on successful settlement; it is not reserved while diners eat.** Concurrent sales/adjustments can make a tracked item insufficient at payment, in which case the entire settlement fails without a sale; the owner must reconcile/cancel the affected round. Optional untracked food and modifiers reuse the existing product form. Ingredient/BOM inventory and reservations remain deferred.

Cash settlement rebuilds the request from stored snapshots and calls the existing private atomic sale routine, under current product locks. One transaction writes payment, sale, historical item names/options/prices, stock movements, audits and CLOSED bill. The table becomes free only with that commit. Repeated requests retain the exact key/version/body; changed bodies or another settlement fail. Requests survive reload in user+org+bill-scoped browser storage. The recovery banner queries settlement first and retries only the immutable original request after 404. No new payment key is generated to resolve an unknown result.

VAT uses current shop configuration at payment. The shared Checkout supports manual discounts, VAT and purchased/enabled coupons, cash only. Split payment, transfer/merge tables and service charge are deferred. COGS uses the normal checkout cost snapshot. Standard sale reports and owner void/restock continue to use normal sale ledgers; voiding a paid sale does not reopen a historical dining bill/table.

## Printing and client behavior

Confirmed rounds print only that round via the configured Print Agent or existing browser fallback. Print failure never rolls back an acknowledged order; its original round has an explicit reprint button. Receipt printing follows successful cash commit immediately and includes the historical table name. No cafe queue is issued for restaurant settlement. Existing receipt-copy paths retain optional restaurant metadata.

Web POS selects the table screen only for RESTAURANT. Retail/cafe flows are retained. Products reuse food options and optional stock, while **cafe starter data remains CAFE-only**. LINE MINI App directs a restaurant user to its existing Open Web flow; restaurant table operation inside MINI App is not implemented. No Agent protocol/installer or SSO changes are needed in this slice.

## Verification and next phases

The additive migration was applied to the confirmed development Supabase target. Remote verification: all three tables have RLS enabled; anonymous board execution is denied, authenticated board execution is granted, and private helper execution is denied. Verification created no shop/table/bill records. A protected Vercel preflight returned health 200 and unauthenticated restaurant board 401.

- Isolated PGlite full migrations: role/tenant/RLS, repeated opens/rounds/payments, stale version, price/name/option retention, tracked/untracked stock, forced failure after sale write proving rollback, unique line IDs, mode/product guards and owner cancellation audit.
- HTTP tests: authenticated routes, management roles, rejected tenant/captured-price injection and original cash request forwarding.
- Print rendering: escaped table/item/note, round-only ticket and restaurant receipt label.
- Browser fixture: table selection, options/note/quantity, sent round and mock printing, cash/change, response-loss recovery after reload and after the automatic board poll (including safe SweetAlert dialog cleanup), responsive/dark layout. Fixtures never mutate a real shop or print to physical hardware.
- PGlite tests do **not** prove concurrent independent PostgreSQL connections. Real two-terminal concurrency and physical printer UAT remain required.

Next: secure per-visit guest QR menu/orders (rate limits, revocation on close, no staff privileges), then table PromptPay integration with durable gateway binding and unknown-result handling. Individual-line cancellation, reservations, split/merge/move tables, kitchen tracking and service charge require later explicit scope.

Rollback: leave additive schema/history in place. Close all restaurant bills before reverting a shop to RETAIL/CAFE; do not drop sale/round history. Roll back Web/API only after no shop remains in RESTAURANT, because older validators cannot parse the third mode.

## Table/cart and shared Checkout update (2026-10-23)

Owner-only `/tables` navigation appears only in RESTAURANT mode and refreshes on a successful mode change. Table management uses the shared Field/Modal/DataTable patterns; occupied tables cannot be edited. The POS floorplan shows every table, green free / red occupied outlines, and the exact configured chair count. Disabled tables remain visible but cannot open a bill. Selecting any open table enters the menu/cart directly with confirmed orders and pending additions separated; checkout is blocked until pending additions are sent.

Migration `202610230002_restaurant_checkout.sql` adds the scoped quote RPC and optional discounted cash settlement. Quote input accepts only bill version, discount and coupon; browser items cannot replace stored bill snapshots. The original cash RPC signature and zero-discount replay identity remain compatible with stored pending requests. Coupon consumption, stock deduction, payment and bill closure stay in the existing atomic sale transaction. Retail/cafe Checkout retains its original API/payload.

Validation: typecheck, production build, 117 test files / 526 assertions; isolated DB coverage includes quote-only coupon non-consumption, discount/VAT/coupon totals, stale version, replay once, void restoration and rollback. Browser QA uses local fixture data and mock printing: table creation, six chairs, open/send/reopen cart, cash discounts/coupon/change, automatic receipt and free table after payment. A duplicate React sibling key found during QA was corrected and the checkout-to-floorplan transition retested. Mobile 390px/dark has no horizontal overflow. No production shop/order or physical printer was used for these checks.

Deployment verification: migration 002 applied successfully to the existing confirmed development target; authenticated quote execution allowed, anonymous quote and authenticated private-helper execution denied. No application records were created by verification.

## Compact floorplan, selected bill and zones (2026-10-23)

Selecting an occupied table keeps the floorplan visible and opens its confirmed-order cart on the right. The two horizontal actions are **สั่งอาหาร** (enter the existing menu/order screen) and **คิดเงิน** (existing cash Checkout). Returning from the menu restores the selected table panel. Free tables still open a bill and enter ordering. Compact cards reduce dimensions while retaining chair counts and green/red status; mobile stacks the selected cart above the floorplan.

Owner table management now has **สร้างโซน** plus zone buttons above the table list. Clicking a zone opens the standard edit/delete modal. Table forms suggest saved zones and retain compatibility with typed names. Zones can exist without tables. Deleting a zone leaves tables unassigned; it does not delete tables, bills, rounds or history. Renaming propagates to current table assignments and increments their versions. Open bills anywhere in the zone block rename/delete. Historical bill/receipt names remain unchanged.

| Owner management API, relative to `/api/v1` | Input | `data` |
| --- | --- | --- |
| GET `/management/restaurant/zones` | none | `[{id,name,version}]` |
| POST `/management/restaurant/zones` | `{name}` | `{id}` |
| PATCH `/management/restaurant/zones/:id` | `{name,version}` | `{id}` |
| POST `/management/restaurant/zones/:id/delete` | `{version}` | `{id}` |

All requests use the existing Bearer session and derive tenant identity on the server; mutation DTOs are strict. 400 invalid input, 401 unauthenticated, 403 owner required, 404 scoped missing zone, 409 duplicate/version/occupied-zone conflict. The existing request/error envelope and safe metadata logs apply. Zone changes emit scoped activity logs.

Migration `202610230003_restaurant_zones.sql` adds the RLS-protected zones table, derives existing zone names from current tables, and adds narrowly granted owner RPCs. A compatibility trigger preserves typed-zone saves from older clients. No existing migration or table/bill API signature changes. Rollback leaves additive zones/history in place and may revert Web/API; legacy table writes continue to work.

Validation for this update: 117 files / 529 tests passed, typecheck and production build passed; final DB tests repeated after explicit zone privilege hardening (`202610230004_restaurant_zone_grants.sql`). Migrations applied to the existing confirmed development target. Remote RLS enabled; anonymous mutation/private-helper execution denied. Browser fixture proved occupied-table side cart, horizontal actions, menu/back/Checkout, create/rename/delete empty zone, and mobile dark 390px with no horizontal overflow. Browser plugin unavailable; provided CUA browser control was used. Production preflight health 200 and unauthenticated zones 401. No real shop sale/printing was performed.

## Restaurant usability fixes (2026-10-23)

Zone modal actions use standard category actions with equal 44px height and natural widths. Table management disables automatic board polling/focus refresh and menu-configuration focus refresh; initial entry and successful mutations reload data. Sidebar mode checks can still refresh in the background but no longer replace the loaded table page with a loading screen, or discard it for a transient background failure. Server permission and optimistic-version checks remain authoritative.

Restaurant product grids inherit the same responsive compact grid as retail/cafe instead of overriding the column count. Selecting a free table requires confirmation before creating/storing an open request; cancel makes no API call and leaves the table free. Occupied-table selection remains direct.

Printing notices are scoped to a navigation generation. Leaving ordering, selecting another table/zone or leaving the route clears the visible message; late print results from the old view cannot restore it or overwrite a newer notice. A committed sale still reports receipt printing failure on its resulting floorplan, until the next user navigation, without reversing the sale.

Validation: 117 files / 529 tests passed; typecheck/build; local browser fixture proved preserved unsaved zone input after repeated focus events, equal 44px modal actions, responsive shared product grid, cancelled/confirmed open-table flow, order/receipt print failures visible then cleared by navigation. Mobile zone modal at 390px has no horizontal overflow. No DB/API or printer protocol changes; no real shop/physical print jobs used.

## Guest QR ordering release

See [guest ordering implementation and API](81_RESTAURANT_GUEST_ORDERING.md). Open-table staff can issue/revoke/print a visit QR; customers order through the isolated `/order/` entry, and confirmed rounds appear in the same bill with guest source and manual preparation-ticket printing. QR access ends on close/cancel/revoke or after 24 hours. Existing cash Checkout, discounts/VAT/coupons, stock deduction at settlement and receipt printing remain the settlement path. Table PromptPay and automatic incoming-round printing are deferred.

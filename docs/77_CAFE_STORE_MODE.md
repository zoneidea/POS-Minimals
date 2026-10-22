# Cafe store mode — 2026-10-22

## Approved scope

A shop selects RETAIL (default) or CAFE in store onboarding, and the owner may change it in Store settings using labeled icon buttons with a visible selected state. Selecting a button changes the form draft; Save and the existing confirmation commit the change, while Cancel restores the saved mode. Existing shops remain RETAIL. Cafe is available without a Marketplace purchase in this release; no paid cafe module is introduced. Products, stock, tax, discounts/coupons, payments, reports and the `/pos` entry remain shared. There are no order types, preparation statuses, tables or unpaid orders. Menu modifiers were deferred from the initial mode release; the subsequently approved implementation is documented in [Cafe options](78_CAFE_OPTIONS.md).

Cafe flow: select existing products → confirmed payment → atomic sale/stock commit and daily queue → receipt with queue → preparation ticket → next sale. Printing failures never retry checkout or stock deductions.

## API contract

- `POST /api/v1/orgs/bootstrap`: optional `storeMode: "RETAIL" | "CAFE"`. With mode, API calls the new `bootstrap_org_with_mode`; omission retains the legacy RPC. Both provisions are transactional and serialize on the same user lock. A retry returns the existing shop without changing its mode or contact.
- `GET/PATCH /api/v1/settings/store`: owner only. GET includes storeMode. PATCH accepts an optional storeMode with the existing optimistic version; omission preserves the stored mode. Existing encrypted store details, audit and cache invalidation remain in place.
- `GET /api/v1/settings/store-mode`: authenticated active member, returns `{success:true,data:{storeMode:"CAFE"}}`. Derives tenant from identity, returns no private settings/contact/bank information, and does not cache mode authority.
- Cash/Gateway endpoints and inputs remain unchanged. Cafe receipts add optional `receipt.cafe:{queueNo:"A001",queueDate:"YYYY-MM-DD"}`. Both backend and Web/LINE decoders preserve it. Old receipts remain valid.

OpenAPI and generated types document the additive fields. Existing clients may ignore cafe metadata; they must upgrade to print cafe tickets. API never sends print requests to local hardware.

## Queue and transactions

Migration `202610220001_cafe_store_mode.sql` adds checked store_mode, a protected per-org/day counter and a small checkout wrapper around the existing coupon/cash/Gateway transactions. The wrapper holds the shop mode row for share while sale commits, so an owner settings update cannot change the mode mid-commit. Counter increment, immutable receipt, payment and stock commit/rollback together. The counter primary key serializes issuing for a shop/day; counters cannot be selected or written directly by authenticated/anonymous users.

Queue date is the **issuing day** in Asia/Bangkok, using database time; for delayed Gateway confirmations it may differ from the provider's paid date. A001 resets with a new day key. Above 999 it continues A1000 without truncation. Replays return the saved snapshot without consuming another queue number. Retail sales receive no cafe snapshot. Switching away and back does not reset that day's counter, alter receipts or clear Marketplace ownership. Voids do not reuse queue numbers.

Mode changes apply to subsequently committed sales, including checkout screens already open. The owner confirmation advises closing active Checkout before switching. No draft/order migration is attempted; there are no cafe unpaid orders in this scope.

## Printing

Existing Agent 1.1.2 `/print` is reused with no protocol/installer change. Web sends the original receipt then the preparation ticket sequentially to the same captured printer profile. A local promise queue keeps cafe pairs from the same POS tab adjacent when sales complete quickly. Cross-tab/multi-application spool ordering is not guaranteed by the legacy Agent; use one cashier POS tab per printer for paired output.

- Receipt: immutable queue in large type plus existing bill/amount/payment details.
- Preparation: same queue, shop, bill/date/cashier and item quantities; no prices or totals.
- Separate print jobs allow the configured thermal driver to cut after each document. Physical cutting depends on printer/driver settings.
- No Agent: one browser print dialog containing both pages in order; browser printing remains user-confirmed.
- Receipt copy and preparation reprint are separate buttons in historical bill details. Voided bills do not offer preparation reprints. Copies are labeled; uncertain failures are not automatically resubmitted.
- Checkout/cart release before printing. An error identifies whether the receipt or preparation could not be confirmed. The successful sale remains recoverable from Sales.

## Landing page

Adds retail/cafe selection and later switching, including sequential cafe printing. Removes fee banner, fee navigation/table, withdrawal/fee FAQ copy and all fee descriptions from structured data. Payment fee calculation and operational reports are unchanged. Static prerender and metadata use the same updated content. No restaurant, modifiers or self-service availability is advertised.

## Validation and rollout

Focused SQL tests cover legacy/new bootstrap, owner/employee/tenant boundaries, version conflicts, immutable queues across switches/replays, Gateway verification, queue-failure rollback, rollover beyond 999 and protected counters. Print tests cover document content, escaping, same-tab sequence and failure without retry. Public render tests check no fees in HTML or structured data. Browser QA uses isolated fake data, not real shop writes or physical printing.

Apply with the existing DatabaseInitializer to the confirmed development Supabase target before deploying Web/API together. No existing shop is switched to CAFE automatically. For application rollback, deploy the previous build and leave the additive migration/data in place; old inputs remain valid. Do not drop counters or rewrite historical receipts.

Physical thermal-printer acceptance for both documents, actual paper cuts, and live shop selection/checkout remain user UAT after deployment. Multi-connection concurrency is designed using PostgreSQL row locks but PGlite tests are single-connection evidence.

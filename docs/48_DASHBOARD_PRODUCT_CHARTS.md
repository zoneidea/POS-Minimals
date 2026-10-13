# Dashboard product charts — 2026-10-13

Dashboard keeps existing daily/monthly metric cards and adds four compact chart cards in one desktop row. Card 1 is the five best-selling products by completed-sale units; card 2 is the five lowest-selling active products that currently have stock, including zero sales. Cards 3/4 are explicitly empty areas for future data, without fabricated figures. Shared 7/15/30-day controls update both rankings in one API request; default is seven days. Two columns on tablet, one on mobile. Native accessible SVG bar charts use real quantities, zero-width bars for zero sales, complete product/stock tooltips and a quantity axis. Card shells remain visible for loading/error/empty states.

## Definitions and API

OWNER GET `/api/v1/dashboard/product-rankings?days=7|15|30` returns `{days,fromBangkok,toBangkok,topProducts,slowProducts}` in the standard success envelope. Each product has `{productId,name,barcode,quantity}`; slow products also have `stockQuantity`. Date range starts at Bangkok midnight days-1 days before today and ends at current transaction time, so today is included and future records excluded. Unknown query fields/unsupported periods reject with 400; non-owner with 403. Existing Dashboard summary remains compatible and unchanged.

Top ranking groups immutable product ID, uses latest sold name/barcode snapshot in the selected window, and retains sales for subsequently deleted products. Low-seller ranking uses current active in-stock product labels; sums only completed-sale items in the same window. Ties sort by oldest sale within the window (never sold first), then creation time and ID. This identifies low-selling stock, not an exact age of physical lots; no lot receipt-date model exists in this project. No profit/cost/private contact data is exposed. No write/reservation/checkout or history mutation occurs.

Migration `202610130001_dashboard_product_charts.sql` adds STABLE, fixed-search-path SECURITY DEFINER RPC `dashboard_product_rankings(integer)` with active OWNER shop derivation. Direct anonymous execution denied; existing table RLS/grants remain unchanged. Both aggregates join tenant-scoped sale items to sales, exclude VOIDED, bound output to five. Existing indexes reused; no invented throughput guarantee.

## Verification

Focused database/API/graph tests pass: all three calendar windows, boundary day exclusion, future/void exclusion, five-row limits, snapshot labels, zero-selling in-stock inclusion, deleted/out-of-stock exclusions, cross-shop/role/anonymous denial, strict query inputs and accessible empty/zero chart rendering. Fixtures are isolated PGlite data and do not prove multi-connection capacity. The fixture parameter initially inferred integer and numeric simultaneously; explicit casts corrected the test data insertion without changing business arithmetic.

Full typecheck/build/test and hosted rollout evidence is recorded after validation. No user-store test products or sales are inserted by the agent.

Full 248 tests, typecheck, build and diff check passed. Migration applied to confirmed development Supabase. Read-only live RPC checks for the known owner shop verify all three windows; no business data mutation was performed during verification. Hosted chart UAT remains pending until rollout.

# Dashboard and reports from real data

## Implemented scope

OWNER `/dashboard`: current Bangkok-day/month completed-sale net amounts, completed bill count, void count for sales completed today, active low-stock count (quantity <=5), cash/PromptPay breakdown and five monthly top products grouped by immutable product ID and ranked by units sold. Voids do not contribute to sales/payment/top-product amounts. PromptPay is currently unavailable; its real recorded total remains zero. Quick links use normal workspace navigation. SQL returns aggregates, not raw sale/cost/identity payloads.

OWNER/ACCOUNTANT `/reports`: sales, inventory, low-stock and current stock valuation; ten-row DataTable pagination. Sales filters: today/week/month/year presets, custom inclusive calendar dates, grouping day/week/month/year and cashier. Summary labels distinguish completed gross, discount, net, VAT and void count/value. Week begins Monday. Dates use Asia/Bangkok, converted to UTC start-inclusive/end-exclusive; a range is limited to 366 days. Groups contain only records within the selected range, not a filled calendar. Inventory reports are current state, ignore historical date/cashier filters and exclude soft-deleted products.

Money is calculated as PostgreSQL numeric and transported/displayed as decimal strings. Historical sales sums use stored sale amounts; top-product names/barcodes/quantities use immutable sale-item snapshots. Each SKU combines old/new sold names into one rank, using the latest sold snapshot label in the period; master edits/deletion without another sale do not change the label. Cashier selector shows current display aliases of historical sale actors, including removed staff, scoped to the shop; it is a filter label, not a historical receipt cashier-name snapshot. Current valuation is quantity × current unit cost, not FIFO or purchase-lot cost.

## API contract

- GET `/api/v1/dashboard/summary`: OWNER only, no query parameters; fixed current Bangkok day/month. `{success:true,data:{todaySales,monthSales,todayBills,todayVoids,lowStockCount,dateBangkok,cashToday,promptpayToday,topProducts}}`.
- GET `/api/v1/reports/{sales|inventory|low-stock|stock-valuation}?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day&page=1&cashierId=UUID`: OWNER/ACCOUNTANT. `{success:true,data:{type,summary,items,total,page,limit:10}}`. Sales rows are grouped periods with gross/discount/net/VAT/bill/void fields; inventory rows are product id/barcode/name/quantity/current cost/price/valuation.
- GET `/api/v1/reports/cashiers`: OWNER/ACCOUNTANT, own shop's historical actor IDs/display aliases.
- GET `/api/v1/reports/:type/export.xlsx` with the same filters: authenticated XLSX download, all filtered rows independent of table page, up to 10,000 rows. More returns EXPORT_LIMIT_EXCEEDED (422), with no truncated success file. Workbook includes filter/summary metadata. Barcodes and amounts remain literal text, preserving leading zeros and decimal precision; product text escapes formula prefixes and is written as string cells. Summary and rows are obtained in one stable RPC snapshot.

Date format/calendar validity, query enum, UUID and pagination are validated; unknown tenant fields are rejected on report query routes. Employee cannot access reports/export/dashboard. Dashboard excludes accountant. No client-selected organization, service-role ordinary read, permission/stock/sales memory cache or direct accountant grant to raw product/sale-item tables. Canonical OpenAPI and generated TypeScript DTOs updated. YAML is deliberately expanded without aliases; parser resource-exhaustion protection remains unchanged.

## Database, dependencies and rollback

Additive `202610120011_reports_dashboard.sql` defines STABLE, SECURITY DEFINER, fixed-search-path report/dashboard/cashier RPCs. Each independently derives the active shop and role from Auth/membership; authenticated grants exclude anonymous/PUBLIC, and cross-shop filters cannot expose another shop. Existing tenant/time/product indexes are reused. No financial, payment, stock or audit history is edited; read request/response metadata uses the existing safe logger.

Both the report migration and additive `202610120012_dashboard_product_ranking.sql` correction were applied to confirmed development Supabase. To disable the feature, unmount menus/routes and revoke the three RPC execution grants; keep financial/history tables unchanged. No production rollout or throughput promise.

Excel generation uses [ExcelJS](https://github.com/exceljs/exceljs). Its sole uuid use is CommonJS v4; a narrow root override pins uuid 11.1.1 to fix the inherited moderate advisory while retaining the existing v4 API. Real workbook write/read tests pass, and npm audit reports 0 vulnerabilities. Transitive deprecation notices and the existing web bundle-size warning remain; no unrelated dependency upgrades.

## Verification

216 tests across 31 files pass, plus typecheck and API/web production build. New SQL tests cover completed/void totals, Bangkok midnight/end-exclusive boundaries, cashier filter, two shops/roles, current valuation versus immutable sale totals after master edits/deletion, owner Dashboard numeric totals/top snapshots and date/export bounds. HTTP tests cover auth, employee denial, accountant report-only permissions, query validation and XLSX content type/filter forwarding. Workbook tests reopen the generated XLSX and verify leading-zero barcode, formula escaping and decimal strings. Single-connection PGlite is not a load/concurrency benchmark.

User confirmed the inline settings form **Pass** before this milestone; store-save and role/suspension UAT remain accepted. Staff reactivation/soft-delete UAT is still unconfirmed.

Next requested item is Excel product import; no import behavior is included in this milestone.

## Local browser evidence

IAB desktop 1280×720 and mobile 390×844: Dashboard net today/month ฿34.00, successful bill count 1, void count 1; sales report net ฿34.00 and separate void value ฿15.00. Month preset and actual cashier selection retained these values. Inventory/valuation showed 10 units × current unit cost ฿10 = ฿100; low-stock reported an empty dataset. These are observations of the user’s existing data, not seeded fixtures. Browser XLSX download reopened successfully with one group row, date range 2026-10-01 through 2026-10-12, month grouping/cashier filter included and net 34.00. Workbook headings/summaries are Thai. Mobile document width 390px at a 390px viewport, with table content scrolling inside its container. No financial/stock records were written during QA. Fresh client reload was necessary after the earlier failed HMR; normal menu navigation stayed in the workspace. Hosted accountant login, larger/multipage datasets and performance/load UAT remain pending.

Dashboard light/dark rendering and normal menu navigation were checked after the ranking correction; console errors were empty. The added ranking regression combines two sales of the same SKU under different stored names into one rank, without consulting the current master name. Full suite remained 216/216; workbook/header refinements subsequently passed the seven focused export/HTTP tests and production build.

User confirmed Dashboard/report UAT Pass before starting Excel product import.


## Financial overview (2026-10-18)

The sales report now includes three cards in a single horizontal row above the existing table: net sales excluding VAT, historical cost of goods sold (COGS), and gross profit with Gross Margin. They follow the applied inclusive Bangkok-date range and cashier filter and aggregate the full filtered range independently of table pagination. Small screens scroll the cards inside the overview, preserving readable amounts. Light/dark styles use KidTang tokens and Prompt.

No operating-expense or operating-profit UI or data model is included, per the user's correction.

### Additive API contract

`GET /api/v1/reports/sales` adds optional `financial` alongside the existing `summary` (which is unchanged):

```json
{"financial":{"netSalesExVat":"150000.00","cogs":"90000.00","grossProfit":"60000.00","grossMarginPercent":"40.00"}}
```

- `netSalesExVat`: completed-sale `total_amount - vat_amount`, after all discounts. Voided sales are excluded; partial returns are not supported by this POS.
- `cogs`: sum of immutable `sale_items.quantity * unit_cost`, joined to completed sales by both shop and sale ID. Current product costs are never used for historical reports.
- `grossProfit`: net sales excluding VAT minus COGS, signed decimal string.
- `grossMarginPercent`: gross profit / net sales excluding VAT × 100, rounded to two decimals by PostgreSQL; `null` when revenue is zero, including fully discounted sales.
- Amounts are PostgreSQL numeric decimal strings; no browser monetary arithmetic. Fee deductions are not included in gross profit.

Migration `202610180002_report_financial_overview.sql` replaces the existing report RPC with the same signature, role checks, search path, grants, summary and pagination. No tables, raw-cost grants, or sale/stock records are changed. OWNER/ACCOUNTANT only; existing request metadata logging remains in use. Backward compatibility: clients tolerate absent `financial` and show unavailable amounts rather than fabricated zeros. Existing Excel summary/columns remain unchanged.

Regression proof covers snapshot costs after master edits, VAT, negative margin, zero revenue, voids, cashier/date filtering, Bangkok midnight, full-range versus page summaries, cross-shop isolation and employee/anonymous denial in isolated PGlite.

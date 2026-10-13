# Read performance — 2026-10-13

Addresses the five findings from the Frontend/API/Database review without changing application architecture, checkout, stock writes, historical snapshots or tenant authorization.

## Changes and compatibility

- Workspace pages load through React lazy imports and Suspense instead of joining the initial bundle. A route/user/org-scoped error boundary offers reload if a chunk fails. Existing responsive styles, page permissions and persisted cart scope remain in place.
- Identity still verifies the JWT against Supabase Auth on every request, then reads active membership and its active/non-deleted organization with one PostgREST inner join. Normal identity resolution uses two sequential upstream requests rather than three; no identity/permission cache, privileged client or client-selected tenant was added.
- `202610130006_read_performance.sql` aggregates each product's latest qualifying completed sale in a single grouped relation for idle rankings, replacing the correlated scan per in-stock product. Added `(org_id,product_id,sale_id)` index supports product history access. Creation-to-latest-sale/today spans, Bangkok dates, void/future exclusions and ties remain unchanged.
- Catalog RPC uses bound dynamic predicates only for supplied filters. Count and ordered page queries are separate, within a STABLE function's read snapshot; the full wide catalog is no longer materialized before pagination. `pg_trgm` GIN indexes on lower(name)/lower(barcode) support substring search; a tenant/category/name/id partial index supports category pages. Existing barcode uniqueness supports exact barcode lookup. LIKE escapes percent, underscore and backslash to retain literal substring semantics. User input is always a bound parameter. Total, page, limit and name/id ordering remain compatible.
- Dashboard can opt out of unused monthly top products. Both HTTP and SQL default behavior still include the existing snapshot ranking. The Web Dashboard requests the metrics-only variant while its selected-window product charts remain independent.

## API contract

`GET /api/v1/dashboard/summary?includeTopProducts=false` requires Bearer authentication and active OWNER membership, as before. Optional query is strictly `true` or `false`; omitted means `true`. Unknown/duplicate/invalid fields return 400. Response fields are unchanged; `topProducts: []` when explicitly false. The backend forwards `p_include_top` to the boolean RPC overload. The no-argument SQL RPC delegates to true for existing callers. OpenAPI and generated TypeScript types document the query.

No new frontend backend payload or endpoint is needed for catalog, rankings or identity.

## Verification

- Typecheck, production build and 262 tests across 42 files passed. SQL tests load the same pg_trgm extension in isolated PGlite. Coverage includes literal wildcard/backslash/quote searches, stable non-overlapping pages, exact barcode and AND filters, role/cross-tenant/anonymous/suspended-shop checks, default versus metrics-only summary equality and safe database errors.
- Identity transport tests exercise the real Supabase client with mocked fetch, verify the inner join and active/deletion filters, JWT propagation, two upstream calls, denied Auth and absence of identity caching. Fake timers drive the SDK's real 503 retries; production retry behavior is unchanged.
- Built main JavaScript: 666.58 -> 570.24 kB minified; gzip 184.81 -> 162.37 kB. Workspace page chunks are separate. DashboardCharts remains approximately 510.62 kB, loaded only when visiting Dashboard. Vite still reports the two >500 kB chunks.
- Local production preview at http://127.0.0.1:4173, Chromium, 1440x1000 and 390x844: mocked Auth/API fixtures, no console errors or framework overlay, meaningful screens, category modal opens/closes, POS cart survives POS -> Categories -> POS navigation, unvisited page chunks absent from initial POS requests, Dashboard requests includeTopProducts=false. Browser plugin skill absent; used the bundled Playwright runtime. This is fixture-based browser QA, not hosted authenticated UAT or real checkout.

## Reproducible local measurements

Same isolated PGlite database before/after migration, generated fixtures, single connection, ANALYZE, one warmup then three timed calls per operation; values below are median wall-clock milliseconds including the local driver. These are diagnostic comparisons, not staging API p95/TPS or production guarantees. Scripts and raw query plans were kept outside the repository under /tmp.

| Fixture | Operation | Before ms | After ms |
|---|---|---:|---:|
| 1,000 products / 50,000 sales and sale items | complete 7-day product rankings RPC | 14,551.99 | 144.93 |
| same | default monthly summary vs Web metrics-only summary | 85.06 | 21.84 |
| 100,000 products | literal substring `needle`, first 10 of 1,000 matches | 110.97 | 8.70 |
| same | exact barcode, one match | 24.63 | 1.63 |
| same | unfiltered page 9,000 of 10-row pages | 272.62 | 68.32 |

EXPLAIN ANALYZE on the large-fixture substring predicate chooses Bitmap Heap Scan with BitmapOr over both new GIN indexes. At 1,000 products, PostgreSQL reasonably chooses Seq Scan: substring RPC measured 2.83 -> 3.81 ms, so the change is not a universal small-data speedup. Deep OFFSET and exact counting still have size-dependent cost because the existing numbered-page contract requires them. One/two-character or common searches may also scan; indexes do not guarantee every query is faster. New indexes add storage and write maintenance cost. The default summary retains its original ranking work; only opted-out calls skip it.

## Development rollout and rollback

The documented development Supabase target was checked; only the new migration was pending and applied through DatabaseInitializer. Existing migrations and checksums were preserved. No fixture/customer/sale/stock rows were written to the remote database. Post-apply verification checks the checksum, four new indexes, authenticated grants and anonymous denial, plus read-only owner catalog/rankings and equality of metric fields with/without top products.

Apply migration before releasing the updated API, because it calls the new boolean RPC overload. Deployment keeps Web and Express together. To roll back application code, existing no-argument RPC and default HTTP behavior still work; indexes may stay. For a database rollback, use a separately reviewed forward migration restoring the prior catalog/ranking functions and no-argument summary body, then drop the new overload/indexes if needed. Do not edit an applied migration or drop a shared extension.

Remaining validation: actual 10-client staging API p95, multi-connection load/lock effects, hosted authenticated navigation, and large-data measurements on the deployed PostgreSQL plan/region. Local results do not certify the performance targets.

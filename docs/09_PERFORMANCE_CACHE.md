# 09 — Performance, Node Cache & DB Concurrency

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Priorities
1. Data correctness under concurrent checkout/stock changes
2. Minimize DB round-trips / duplicate queries
3. Keep transactions short and locks predictable
4. Optimize perceived UI responsiveness
5. Scale Vercel Functions without shared process state

## 2. Node Cache policy (`lru-cache`)
**Cache allowed:** category list, non-sensitive display store settings, product catalog read-only metadata (careful for prices); TTL suggested 30–120 seconds.  
**Never cache as authority:** quantity_on_hand, sale/payment state, inventory adjust, session/membership/permission, OTP, checkout totals, idempotency results.  

- Scope every key: `org:<orgId>:categories:v<version>`; separate role-dependent response shapes
- Invalidate in-current-instance on update and use short TTL for other instances; if strict immediate consistency required, bypass cache and query DB directly or implement version-check mechanism
- On Vercel Function cold start/scale-out, cache is empty; must work correctly on cache miss
- No promise of cross-instance shared invalidation or persistent Node cache
- If user expects all instances to see changes immediately, **do not cache that data** until shared invalidation/versioning is implemented
- Frontend TanStack Query has its own per-browser cache; invalidate after mutations

## 3. Database access optimization
- Catalog: paginated queries with select only required fields; no SELECT * for list; proper indexes `org_id,deleted_at,category_id`
- Dashboard/report: grouped/aggregate SQL on DB, not fetch all raw orders to browser
- Product import: bulk staging/validation and insert/update in batches, not one API per row
- Transaction logic in narrow PostgreSQL RPC instead of multiple independent HTTP writes
- Avoid nested N+1 queries: load product batches with `WHERE id = ANY(...)`
- Query planner / EXPLAIN ANALYZE index review based on data size
- Bound lists max 100, Excel exports date range/size; background export only if volumes demand (outside MVP)

## 4. Deadlock/stock race prevention
- Checkout locks product rows in ascending product UUID order before mutations
- Void locks sale then products in ascending product UUID order; stock adjustments lock single product
- Keep critical work (no external API calls/image upload/printing) **outside DB transaction**
- Nonnegative quantity DB CHECK + same-transaction validation
- Retry only on explicitly transient DB contention with bounded backoff and idempotency; avoid blindly retrying authorization/validation errors
- Track lock-wait/deadlock in monitoring; perform test with overlapping carts (A+B and B+A)
- Never query amount from cache during checkout; DB is authoritative

## 5. Frontend performance
- Debounce typed search ~200–300ms; scanner Enter should search immediately
- Virtualize large result lists only if benchmark warrants it; paginate server-side
- Lazy-load reports/dashboard; images lazy with thumbnails/sizes; avoid heavy export library in initial POS bundle
- Render list/grid with stable keys; loading indicators on every fetch, action-specific submit indicator
- Keep cart in lightweight persisted store; do not re-fetch or reinitialize cart on route changes
- Guard against stale requests overwriting newer search results (TanStack Query keys / abort)

## 6. Proposed initial performance targets (verify in staging)
| Scenario | Initial target | How to measure |
|---|---|---|
| Product catalog GET | p95 <500ms | 10 concurrent clients, seeded 1,000 products/org |
| Checkout including stock update | p95 <1.5s | 10 concurrent clients, 1–5 items per bill, non-print |
| Duplicate idempotency submit | exactly one completed sale | parallel requests with same key |
| Concurrent sale limited stock | 0 negative stock, 0 double sells | 20 simultaneous requests, 5 units available |
| Dashboard initial fetch | p95 <1s | seeded 50,000 sales/org, indexed aggregates |
| Cross-tenant DB query | 0 records leaked | test 2 orgs and multiple roles |

**Important:** ตัวเลขเป็น acceptance **target** ไม่ใช่ผล benchmark จริงและไม่ใช่การรับประกัน TPS; staging ต้องทดสอบบน plan/region และข้อมูลจำลองใกล้ production.

## 7. Metrics and observability
- API request rate/error rate, p50/p95/p99 per route, cold starts
- Supabase slow query log, connections, DB CPU, lock waits, deadlock count
- Cache hit/miss by module and tenant (ไม่ log tenant-sensitive payload)
- Stock conflict frequency, payment double-submit blocked, import rejects, receipt print failures (client-side reporting optional)
- Regional latency Vercel API -> Supabase database


## Traffic and future multi-client considerations
- Once enabled in later phases, frontend, JavaFX and mobile traffic shares the **same backend concurrency and database pool**; do not estimate capacity by Web users only. Separate metrics by `X-Client-Platform` for diagnosis, but throttle fairly by IP/user/org regardless of declared platform.
- Rate limits and idempotency must work across Vercel instances; process-local node cache cannot hold a security-sensitive limiter or idempotency state. Use edge/provider-level rate limits or durable DB-backed counters when correctness requires it.
- Future JavaFX barcode scanners may produce bursty GET requests; coalesce/debounce catalog calls client-side, never cache authoritative stock for checkout. Observability must aggregate endpoints across all clients.

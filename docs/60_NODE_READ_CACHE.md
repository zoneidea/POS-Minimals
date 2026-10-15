# Node read cache — 2026-10-15

The Express app uses a reusable per-process NodeReadCache. Cached payloads are AES-256-GCM encrypted with an ephemeral process key, capped at 512 entries / 8 MiB of ciphertext (metadata and in-flight requests are additional). Keys hash the authenticated token, current full user context, resource and normalized validated query. Raw tokens, search terms and identities are not retained as keys or logged. Values are cloned; failed loads are not cached. Concurrent identical loads share work; invalidation prevents older in-flight results refilling the cache. Expired entries are removed during access and LRU entries are evicted at the bounds.

| Data | TTL |
|---|---:|
| Store settings | 30 seconds |
| Payment configuration | 15 seconds |
| Categories, including pagination | 30 seconds |
| Inventory/POS products, including filters and pagination | 3 seconds |
| Staff list and identity-profile response | 5 seconds |

## Authorization
Every route still resolves live Supabase Auth and current active membership/organization/role before accessing cached data. Simultaneous identity resolutions for the same token may share one in-flight check, but completed authorization is never retained. Identity-profile payload caching includes the freshly resolved context in the key: a role/status/permission change cannot be authorized by a cached response. Accountant/employee restrictions and existing RLS are unchanged. Stock quote, sale commit, cancellation, audit and other transactional operations bypass the data cache.

## Invalidation and deployment boundaries
After non-read API requests finish, this instance clears the cache, including pending-read generations. This includes settings/payment/staff/category/product/image changes, sales, stock adjustment, cancellation and import commit. Quote and import-preview POSTs do not invalidate. Invalidating on failed mutations is conservative and also covers partial local saves followed by external failures. No stale fallback is returned on backend errors after expiration.

Each Vercel function instance has its own cache. Cold starts and requests reaching another instance may miss. Writes invalidate only the serving instance; another instance may show data up to its short TTL. Current permissions and financial validation remain live regardless. This feature reduces repeated data reads; it does not remove Auth/membership network cost or move the API/database regions. HTTP Cache-Control remains no-store; no browser/CDN cache or API payload change is introduced.

## Validation
Focused tests cover TTL, clone isolation, load failure, LRU/payload bounds, invalidation during a load, token/tenant/role/query separation, concurrent identity checks, permission revocation and API data-read reuse. Before/after assertions compare service/database-read call counts rather than claiming a production latency improvement without an authenticated production benchmark.

Full isolated repository verification: 58 test files / 335 tests passed, TypeScript and production build passed. Existing local test deletions were preserved; the complete committed test suite ran from an external clean snapshot with only this change overlaid.

# Optional Upstash read cache — 2026-10-16

## Scope and configuration

Store settings (`store`) and category pages (`categories`) use an optional shared
Redis cache with a maximum 30-second TTL. Products, stock, payment settings, staff,
identity, transactional sales, quotes and reports do not gain Redis caching.
Their existing behavior is preserved. API payloads, UI, RBAC and database schema
are unchanged; no new dependency is required.

Set backend-only `UPSTASH_REDIS_REST_URL` and the read/write
`UPSTASH_REDIS_REST_TOKEN` in `.env.local` and the desired Vercel environments.
`SALE_SNAPSHOT_KEY` must be the existing 32-byte hex secret, identical across
instances in an environment. Never use a `VITE_` prefix or commit real values.
Restart local API / redeploy Vercel after changing environment variables.

Namespace derives from Supabase target, Vercel environment (`local` outside
Vercel), and `UPSTASH_CACHE_NAMESPACE` or `APP_PUBLIC_URL`. Use a distinct explicit
namespace when independent preview branches share one Redis database. Keep it
stable between releases for cross-instance invalidation during rolling deploys.

## Read and invalidation behavior

Every route still validates the live identity/membership/role before cache access.
Keys hash the existing full token/context/resource/validated-query scope. Values
are encrypted with AES-256-GCM using a purpose-derived key, random nonce and key
binding (AAD). No raw bearer token, shop identity, phone or query text is stored
in Redis keys. Shared cache entries are capped at 512 KiB encoded per value.

Shared reads bypass completed Node entries, so another instance's invalidation
is observed on the next read. Same-process in-flight requests can still coalesce.
An atomic Lua read returns the current namespace generation and matching value.
A miss loads Supabase once and conditionally stores only if the generation is
unchanged; time spent loading is deducted from the TTL. Failures are not cached.

Store/category/bootstrap mutations clear Node cache and await a Redis generation
change before sending their JSON response. Invalid 4xx requests do not invalidate
Redis. Server errors conservatively invalidate because partial writes may have
occurred. Existing local invalidation remains for all other business mutations.
Old pending reads cannot refill a new generation. Unreachable entries expire
naturally; there is no `FLUSHDB`, bulk key scan or deletion of unrelated data.

Redis commands use HTTPS REST POST with an 800 ms per-command timeout. A Redis
error/corrupt ciphertext opens a 30-second per-process bypass and reads use the
database directly; safe warnings are throttled to once per minute. Database errors
propagate without a second load. Redis failure does not change a successful
business write into an error. If invalidation itself fails, other instances may
still see an existing entry until its original TTL expires (at most 30 seconds).
This is suitable only for the nontransactional resources above.

## Operations and rollback

Choose a Redis primary region close to the API and benchmark from the deployed
API. A cache hit still includes live authorization and a Redis network round trip;
this does not guarantee lower latency for every request. Cache misses include
Redis read/write overhead. Budget request quotas and inspect Upstash metrics.

Remove both Redis variables and restart/redeploy to return to the existing Node
cache. Redis data expires without database migration or data conversion. Old
instances without Redis only invalidate their local cache, so allow the original
30-second TTL during the initial mixed-version rollout.

Reference: [Upstash REST commands, scripting and response format](https://upstash.com/docs/redis/features/restapi).

## Verification

Focused tests cover independent-instance reuse, encryption, TTL, clone isolation,
cross-instance mutation invalidation, invalidation during an in-flight miss,
tenant/user/token/role/query separation, unchanged product cache, live suspension
and accountant denial, corrupt values, size bounds, Redis fallback/circuit and
database errors. Live connection testing uses only synthetic short-lived probe
data, without reading or modifying shop records.

2026-10-16 verification: full isolated committed-test snapshot passed 75 files /
387 tests, typecheck and production build. Two additional store-save/permission
and failed-invalidation cases passed afterward (focused cache suite: 19 tests).
Existing user-deleted local tests were preserved, not restored or committed.
Live synthetic probe reused one source load across two independent cache objects,
with no fallback warning; initial miss/read+write took 402 ms and the hit 35 ms
from the developer machine. These are connectivity observations, not an
authenticated Vercel performance benchmark. Probe values expired after 10 seconds.

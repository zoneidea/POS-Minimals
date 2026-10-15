# Redis session authority — 2026-10-16

User approved replacing repeated Supabase identity/membership reads with Redis
authority after the first verified read. This supersedes the earlier requirement
in docs 60/67 to resolve live membership before every cached API read. Supabase
remains the source of truth, Auth provider and database/RLS authority.

## Flow and lifetime

When Upstash is configured, `createSessionAuthority` handles the API session-day
guard and identity resolver. A request-local memo shares one verified result
between those layers and any overlapping routers. Completed permissions are not
kept in a Node memory cache. Successful identities are encrypted in Redis for
at most five minutes, bounded by JWT expiry and the next Thai midnight.

The key is a SHA-256 fingerprint of the **complete access token**. JWT claims are
parsed only to restrict scope/lifetime and locate revocation. They do not grant
access. An uncached token must pass the existing Supabase getUser, active
membership/shop lookup and session-owner/day RPC. Its verified user must match
the token subject. A hit can only match the exact previously verified token and
an authenticated AES-GCM ciphertext bound to that key. Refreshed/modified tokens
have different fingerprints and must be verified again. JWT signing-key changes
or asymmetric-key migration are not required.

Warm store/category metadata may reuse the existing encrypted Node cache only
after this request's successful Redis auth read has returned a generation. Its
local cache key includes that generation and the full existing user/resource
scope. Thus a mutation in another instance changes the observed generation and
bypasses old local data. This removes a second Redis round trip on warm reads
without retaining permissions locally. Redis failures/auth fences do not provide
a generation and therefore cannot reuse this metadata shortcut.

With session authority enabled, an empty metadata L1 reads Supabase directly
instead of making another Redis payload read: production data queries measured
31–71 ms versus roughly 170 ms per Redis round trip. A cold instance therefore
loads its own metadata once, then reuses it for 30 seconds under the validated
generation. Redis remains the shared session/generation authority. When session
authority is disabled, the existing shared Redis payload cache remains available.

Every endpoint still enforces its OWNER/EMPLOYEE/ACCOUNTANT permissions using the
resolved context. Service queries keep user JWTs and RLS; writes still enforce
current membership, stock and transactional rules in PostgreSQL. This change
avoids redundant **identity** queries; it does not eliminate business DB queries.

The public session-policy response continues to return the session's actual
Thai-day deadline, not access-token expiry, so refresh does not shorten or extend
the original daily session. Onboarding/invitation paths may establish a valid
session deadline before membership exists; protected data routes still deny them.

## Revocation and permission changes

Before PATCH `/users/:id`, cached OWNER authorization is required, then an atomic
Redis script rotates the generation and places a five-minute auth fence. While
the fence exists, reads use fresh Supabase checks and cannot refill auth entries.
This closes the stale in-flight refill window even if a later write/invalidation
fails. The fence duration covers the entire auth TTL and exceeds API maxDuration.
It is namespace-wide: after a staff role/status mutation, identity caching is
temporarily bypassed for up to five minutes. A failed Redis fence returns 503
**before** the membership mutation; it never silently changes DB rights while
leaving an authoritative old cache active.

Store/category/bootstrap mutation invalidation also rotates the shared generation,
so identities referring to changed store metadata reload as needed. Direct edits
through Supabase Dashboard or external Auth changes bypass app invalidation;
cached authority may remain until its original TTL (at most five minutes).
Immediate suspension should use the POS staff-management endpoint.

POST `/api/v1/auth/logout` requires a bearer token and no body. It verifies the
token, writes a hashed `session_id` revocation marker until Thai midnight, and
ends that session at Supabase Auth before acknowledging `{success:true,
data:{revoked:true}}`. The browser then clears its local Supabase session. All
refreshed access tokens with that session_id are denied; other device sessions
stay active. Logout is deliberately current-session/local scope. The session-day
guard does not block this endpoint, allowing onboarding/suspended users to leave.
Expired/invalid tokens return 401 and the browser may still clear local state.
If Redis revocation fails, return 503 and retain local state for retry.

Redis read failures fall back to **fresh** Supabase identity and session checks,
without reusing the immutable per-process day cache. This ensures a session ended
at Supabase cannot regain access through fallback. Revocation/fence failures are
fail-closed. DB errors are not cached or retried with previously authorized data.

## Deployment and rollback

Deploy Web/API together and reload already-open clients once to pick up the new
logout handshake. Old browser code clears Supabase state without a Redis marker;
its cached access token could otherwise persist until TTL. No SQL migration or
new environment secret is required. API and Redis should both be near Sydney.
Set server `AUTH_CACHE_ENABLED=false` and redeploy to restore live Supabase
resolution; retain Redis resource caching. Existing in-flight requests may finish
with the snapshot they started with; subsequent requests observe the new policy.

## Verification

Tests cover independent API instances, one Redis auth read per HTTP request,
cross-request Supabase-read reuse, exact token fingerprinting, user/session
isolation, forged tokens, TTL/JWT/day expiry, role/status revocation, Redis
failure, fail-closed mutation fencing, current-session logout including refreshed
tokens, onboarding access and continued protected-route denial. Existing DB/RLS
and transaction tests remain required in the full isolated regression snapshot.

## Delivery evidence

Typecheck and production build pass. The isolated complete regression passed
78 files / 404 tests; the additional generation/metadata test and final source
passed GitHub Platform checks (405 total cases). A busy-machine two-worker rerun
hit two unchanged DB test deadlines; both passed unchanged in isolation and the
complete one-worker run passed. No assertions/timeouts were relaxed and existing
user-deleted local tests were not restored or committed.

Live synthetic Upstash tests passed encrypted cross-instance context reuse,
revocation and fencing, with no fallback warning. All probe keys were isolated
and removed. Authenticated production browser reads loaded store, categories and
inventory successfully without editing business records or ending the user's
session. The latest deployed browser had no console errors. Logout/recovery
revocation was tested automatically; the real user's session was kept active.

Final backend warm store reads measured 173 ms and warm categories 187 ms in
the sampled run. Cold metadata loads measured 260–278 ms; a five-minute authority
revalidation measured 1,326 ms and is not represented as a warm-cache hit.
Warm inventory loaded in 418 ms, including 240 ms of actual product/image data
work. Warm log entries contain only Redis/session (and data on a miss) timings:
no Supabase Auth or membership step is executed on the authority-cache hit.
These are server timings, not browser end-to-end guarantees. Redis remained
roughly 170–190 ms from Sydney during these observations; confirming the actual
Primary Region remains an infrastructure follow-up, not a claimed improvement.

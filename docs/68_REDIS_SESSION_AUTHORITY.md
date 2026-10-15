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

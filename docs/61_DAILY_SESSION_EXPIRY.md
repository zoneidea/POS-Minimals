# Calendar-day login expiry — 2026-10-15

Sessions end at 00:00 Asia/Bangkok after the day they were created. This is a calendar boundary, not a 24-hour timeout. Refreshing tokens does not extend the deadline, and signing in on another device does not extend an older session.

## API contract and database
Additive migration 202610150001 defines authenticated-only `current_session_expires_at()`. It derives the JWT session_id and auth.uid(), verifies the matching auth.sessions row and computes the next midnight in Asia/Bangkok from immutable created_at. It accepts no user-supplied identity. The function exposes only expiry; auth.sessions remains private. A missing/mismatched session fails closed. DatabaseInitializer applies the migration before the application rollout.

`GET /api/v1/auth/session-policy` returns `{success:true,data:{expiresAt:<ISO date-time>}}`. Every protected API request checks the deadline before identity and cached business data. Missing/expired sessions return 401; crossing the day specifically returns SESSION_DAY_EXPIRED. Missing/unavailable policy returns 503. Health and public client configuration remain accessible. The server caches only the immutable expiry (encrypted, token-hashed, bounded, no longer than Thai midnight), not membership or permissions. Token rotation loads the same original session deadline. Existing current-role checks remain live. Supabase Auth itself is unchanged; this is the POS API's calendar-day access policy.

## Browser behavior
The reusable useDailySession hook reads the server deadline, schedules expiry and rechecks on focus, pageshow, visibility/storage events and API SESSION_DAY_EXPIRED. It retains deadline metadata for the same session_id across token refresh/reload, allowing previously loaded deadlines to expire while offline. A new session ID has its own deadline. Only the project's Supabase auth key, code-verifier key and deadline metadata are removed; carts, draft sale recovery and printer settings remain intact. Auto refresh stops and local sign-out is best effort, with local storage cleared even when sign-out cannot reach the network. Expired UI returns to login with an explanatory message. Recover-password/invitation sessions created today continue normally. The API is authoritative if the client clock or local metadata is changed.

An invalid/expired access token may still use the existing ordinary refresh flow. SESSION_DAY_EXPIRED does not retry refresh. Auth secrets are not logged. Existing API request metadata records denied requests without token/session contents.

## Validation
Tests cover SQL tenant/session ownership, anonymous denial, 23:59:59/00:00 Thai boundary, immutable deadline after token refresh, fail-closed API errors, cache bypass prevention and auth-only browser-storage cleanup. Browser QA uses a five-second injected deadline and dummy auth/cart keys, with no real sign-out or account changes. Full repository and deployment checks are recorded with completion.

Supabase documents session_id as the auth.sessions primary-key reference: https://supabase.com/docs/guides/auth/sessions.

Verification completed: 61 files / 343 tests, typecheck and production build passed. Browser deadline simulation cleared dummy auth keys while retaining PEPSI x 1 in the dummy cart. Migration was applied to the confirmed project before deployment; no auth-session rows or business data were edited by the rollout.

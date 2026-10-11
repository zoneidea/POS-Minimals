# Session expiry — 2026-10-12

Identity GET retries once after 401 using Supabase SDK refreshSession. If the refreshed JWT also fails, show a session-expired notice with a local signout/login action. No mutation is automatically retried. 403 remains membership/role restricted; 503/network failures remain retryable connectivity errors.

The identity effect depends on account ID and explicit retry rather than every token refresh, preventing SDK TOKEN_REFRESHED from restarting the refresh loop. Old account requests are aborted when account ID changes; a refresh returning a different user is not retried. Account context is cleared before revalidation and on signout.

Tests cover one refresh/one retry, repeated 401, 403/503, account mismatch and offline refresh. Browser smoke observed the existing session was rejected and the session-expired notice/login action displayed. No credentials were changed and token expiry was not forced by the agent. Further business endpoints must follow the same boundary; this implementation handles identity lookup only.

The user confirmed live password reset succeeded for the preceding slice. This records user-reported UAT and does not claim independent observation or global token revocation.

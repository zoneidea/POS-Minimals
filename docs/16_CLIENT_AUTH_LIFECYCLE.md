# 16 — Cross-Platform Authentication / Token / Tenant Lifecycle

> **Scope status: REFERENCE / FUTURE PHASE ONLY.** React Web App and Express API are the sole Phase 1 deliverables. Native client implementation, SDK generation, installer, device printing and cross-client CI are not authorized by this document.

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Signup and first login (Phase 1: React Web; future clients reuse protocol)
1. Enter store name, unique email, display username (not unique), password.
2. Call **Supabase Auth public signup**. If email verification configured, wait for verification before bootstrap.
3. Signed-in caller with valid access JWT calls `POST /api/v1/orgs/bootstrap` with `{storeName,displayUsername}`. Backend uses verified `auth.uid`, creates org + store settings + owner membership in one Postgres transaction and returns same org on retry. Two concurrent bootstrap calls from same user must not create multiple orgs.
4. `GET /api/v1/auth/me` returns allowed `{userId,orgId,orgName,username,role,permissions}`.
5. Backend can safely reconcile Auth user created without org because Auth and Postgres onboarding is not one distributed transaction; show retry/recovery UI instead of leaking orphan records.

## Login (all clients)
- Supabase Auth via supported browser SDK, Java public REST Auth SDK, or mobile Auth SDK.
- Business APIs use `Authorization: Bearer <access_token>`; API verifies JWKS/signature, expiry, issuer/audience as appropriate and looks up ACTIVE membership on every request.
- One active org membership/user for MVP; all data scoped from server-side membership. User cannot claim another org in payload.
- OWNER can invite and suspend, but staff must choose their own password. Revocation effective on next protected request regardless of token expiration.

## Token storage & refresh
| Client | Access & refresh token handling | On expiry |
|---|---|---|
| React Web | Prefer auth SDK session handling; minimize XSS exposure (CSP, no unsafe-inline, no token logs) | Refresh once with SDK, then re-fetch `/auth/me` |
| JavaFX | Prefer OS secrets vault for refresh token; short-lived access token memory; memory-only with re-login if vault unavailable | Single-flight refresh public Auth endpoint; retry safe requests |
| Android/iOS future | Android Keystore/iOS Keychain through supported library; **never** hardcoded into package | Background refresh SDK when possible; logout and clear if revoked |

No client contains Supabase **secret/service_role** key or DB connection string. Public/publishable key can appear in client, but still requires strict RLS and backend auth. Credentials and tokens are never placed in URL parameters, telemetry, print receipts, logs or analytics.

## Native vs browser
- API may apply allowlist CORS for Web origins; absence of Origin must NOT block legitimate JavaFX/Android/iOS HTTPS API use.
- CORS does not protect against Java/custom HTTP clients and must NEVER replace JWT/membership authorization.
- `X-Client-Platform` and `X-Client-Version` are non-security metadata, can be spoofed; do not grant rights based on these values.

## Error handling
- 401 access expired: refresh once; for reads retry once. For writes check operation idempotency status before any retry.
- 403: role/membership disabled or action disallowed; clear operational UI route; show role restriction, do not attempt client-side elevation.
- 409 / 422 for stale cart/payment: show server message and require new quote/reconfirmation.
- System time/window decisions e.g., 24h void are **server time** only. Device clock never decides access.

## Security acceptance
Two stores A/B with different roles, signed but suspended member, tampered JWT, spoofed X-Client-Platform and native request without Origin all must respect the same access policy. Add automatic checks for no secrets in installers/build outputs.

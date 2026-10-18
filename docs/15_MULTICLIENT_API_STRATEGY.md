# 15 — Shared API-First Architecture & Integration Strategy

> Update 2026-10-18: ผู้ใช้อนุมัติเตรียม API และแผนรวมเท่านั้น ยังไม่เลือก/เริ่ม Native Client. ใช้ [73: คู่มือ API ที่ตรวจจาก implementation](73_CROSS_PLATFORM_API_GUIDE.md) และ [74: แผนรวม](74_CROSS_PLATFORM_DEVELOPMENT_PLAN.md) แทน draft เรื่อง endpoint, pagination, cash/Gateway flow, daily session และนโยบาย authorization cache ที่ต่างจากระบบปัจจุบัน.


> **Scope status: REFERENCE / FUTURE PHASE ONLY.** React Web App and Express API are the sole Phase 1 deliverables. Native client implementation, SDK generation, installer, device printing and cross-client CI are not authorized by this document.

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Intent
In the future, one backend **can serve** React Web + JavaFX Desktop + Android/iOS Application. **Phase 1 serves only React Web** with identical `/api/v1` endpoints, DB transactions, tenancy, payment rules, role rules and reports. Desktop App and Web App are separate user interfaces **not separate backends**.

```text
   React Web (Browser/Vercel) ──────┐
   JavaFX Desktop (Java 21+) ───────┼── HTTPS + Supabase Access JWT ──> Express REST API /api/v1 (Vercel Functions)
   Android / iOS App (future) ──────┘                                          |
                                                                         services + validation
                                                                                |
                                                    Supabase Auth / PostgreSQL + RLS / Storage
```

## Ownership boundaries
| Responsibility | React Web | JavaFX | Future Mobile | Shared Express / Supabase |
|---|---|---|---|---|
| Login UI/Auth public SDK | Yes | Yes | Yes | JWT verification + org role resolution |
| Display price/stock | Yes | Yes | Yes | **Authoritative query** |
| Cart draft after navigation | localStorage per user/org/device | local SQLite/JSON encrypted as necessary | secure app-local store (non-secrets) | No in-memory user cart |
| Final price/VAT/discount | preview only | preview only | preview only | **Postgres decimal calculation** |
| Stock and payment writing | Never direct | Never direct | Never direct | **single DB transaction/RPC** |
| Sales reports/history | UI/export | UI/export | UI/export | **Shared immutable snapshot queries** |
| Receipt generation | HTML/CSS renderer | Java print renderer | OS native renderer | JSON receipt snapshot, versioned |
| Printer/USB/Bluetooth access | Browser/kiosk/Hub | Java native adapter | OS print/Hub | No hardware access |
| Secret Supabase service key | Never | Never | Never | backend-only if privileged action required |

## Canonical API details
- Base: `https://<api-host>/api/v1`, all business APIs protected except `/health`, `/client/config`, and auth-provider flows hosted by Supabase.
- Route/Schema source: `07_API_CONTRACT.md` + `contracts/openapi.yaml`; contract change must precede implementation. Native app has same URLs/permissions and cannot bypass Auth or RLS.
- Native app does not need browser CORS: `Origin` is optional; strict CORS for allowed Web origins is a browser behavior and is not an authorization control.
- Request headers include `Authorization`, `X-Client-Platform`, `X-Client-Version`, `X-Request-ID`; `Idempotency-Key` required for sale. Do not trust platform headers for role/tenancy.
- Error envelope/codes, pagination, timestamps and money fields are **identical** for all clients. Java uses `BigDecimal`, React uses a decimal-safe library (not floating point), mobile uses exact decimal implementation.
- Phase 1 generates/maintains **TypeScript SDK only**. JavaFX/Android/iOS models and adapters may be added when those projects are approved.

## Auth flow
Sign up/Sign in via Supabase Auth public endpoints. Bootstrap via signed `POST /orgs/bootstrap`, fetch `GET /auth/me`. Each API checks active member from database, not cached claims. See `16_CLIENT_AUTH_LIFECYCLE.md`.

## Workflow: cash/PromptPay sale
1. Client barcode search -> `GET /products`, local draft cart (per user, org, device).
2. Quote -> `POST /sales/quote`, display server totals/QR. No reservation.
3. Checkout -> `POST /sales` with `Idempotency-Key` saved durably with current operation in client, `expectedUnitPrice` + `expectedVersion` and `expectedTotalAmount`.
4. DB atomically recomputes prices, checks cash>=due (or manual PromptPay confirm), locks/decrements stock, writes immutable sale/payment/snapshot/movements.
5. API returns stable sale result + receipt JSON; each client invokes local print adapter after success.
6. Timeout -> status lookup by original key, **never** create a new sale without confirming previous outcome.

## Operational constraints
- Stateless Vercel Express; do not use global in-memory session, cart, rate-limit or idempotency state. Node `lru-cache` only best-effort short TTL metadata. No long-lived WebSocket server running inside Vercel Function.
- Make API endpoint region close to Supabase region, use bounded DB pool/RPC, pagination, indexes, audit logs and latency traces. All clients contribute to API rate/concurrency.
- No offline checkout in MVP; app may keep an unsent *draft cart* locally but must not claim a completed sale offline.

## Non-goals
No native GUI/app source in web package; JavaFX GUI/installer is separate project. No auto bank integration, no universal silent-print guarantee, no direct Supabase Postgres key in native binaries, no per-client duplicate business services.

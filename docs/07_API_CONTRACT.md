# 07 — REST API Contract v1 (Phase 1: React Web; future-client-ready)

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

**Source of truth**: `contracts/openapi.yaml` for machine-readable schemas; this Markdown gives rules, RBAC and representative payloads. Base `/api/v1`; public HTTPS for production. **Implement and test the React Web client only in Phase 1**; JavaFX/mobile are future consumers and are NOT development deliverables. Keep protocol neutral without generating Java SDK now.

## 1. Universal request/response conventions
- HTTPS, UTF-8 JSON, `Authorization: Bearer <Supabase access JWT>` on protected routes. Obtain/refresh tokens with Supabase Auth public SDK/REST. Never call business CRUD via direct Supabase DB from the client.
- `X-Client-Platform: WEB|JAVAFX|ANDROID|IOS|OTHER` and `X-Client-Version: 1.0.0` are diagnostics only, not authorization. `X-Request-ID` optional UUID for correlation; API returns `requestId`. CORS is browser-only; native Java/mobile can use HTTPS without an Origin header.
- All IDs: UUID strings; all monetary amounts: **fixed 2 decimal places as strings** (e.g. `"120.00"`), timezone: ISO-8601 UTC on the wire; display Asia/Bangkok. Barcode: string including leading zeroes. JSON properties: camelCase. No Java-specific DTO or database-specific response structures.
- Success envelope `{"success":true,"data":{...},"meta":{}}`; errors `{"success":false,"error":{"code":"CART_STALE","message":"...","details":{}},"requestId":"uuid"}`. Standard HTTP 400/401/403/404/409/422/429/500/503.
- Pagination: `page=1&limit=20`, max 100, success `meta: {page,limit,total,totalPages}`. Errors have stable `error.code` and localized user-facing client strings; `message` not for logic branching.
- Server infers active `orgId` from verified auth membership (MVP one active org/user); owner cannot request arbitrary org through header/route/query. Non-member and cross-org object lookups return 404 or 403 per endpoint privacy policy.

## 2. Auth and onboarding (canonical)
| Method | Endpoint | Roles | Behavior |
|---|---|---|---|
| GET | `/health` | public | liveness only; no tenant data |
| POST | `/orgs/bootstrap` | signed-in, verified, not already provisioned | idempotent create organization + OWNER membership + settings; registration only *after* Auth signup |
| GET | `/auth/me` | active member | `{userId,orgId,role,username,permissions,orgName}`; authoritative role/profile |
| GET | `/client/config` | public | API version/support info; never secrets |
| GET | `/users` | OWNER | member list |
| POST | `/users/invitations` | OWNER | invited email + role |
| PATCH | `/users/:memberId` | OWNER | role/status change + last-owner check |

**Registration:** `supabase.auth.signUp(email,password)` or public Auth equivalent -> verify email if enabled -> obtain access token -> `POST /orgs/bootstrap` `{ "storeName":"ร้านตัวอย่าง", "displayUsername":"สมชาย" }` -> `GET /auth/me`. Password is **never** sent to Express or stored in business tables. Existing v1 web `/auth/register-store` is **removed before launch**; do not implement or use this insecure/double-path behavior. JavaFX earlier `/me` is renamed to `/auth/me`.

## 3. Catalog / Inventory / Categories
| Method | Canonical endpoint | Roles | Notes |
|---|---|---|---|
| GET | `/products?search=&barcode=&categoryId=&page=&limit=` | OWNER, EMPLOYEE | POS catalog fields only, tenant-scoped |
| GET | `/inventory/products?search=&page=&limit=` | OWNER | complete product list incl cost/qty |
| POST | `/inventory/products` | OWNER | create; barcode unique per org including soft-deleted |
| PATCH | `/inventory/products/:id` | OWNER | update + `expectedVersion`, audit before/after |
| DELETE | `/inventory/products/:id` | OWNER | soft delete, audit |
| POST | `/inventory/products/:id/adjust-stock` | OWNER | `delta` signed int, required `reason`, `expectedVersion`; atomic stock movement |
| POST | `/inventory/products/:id/image` | OWNER | signed/upload intent, validate bytes & MIME |
| GET | `/inventory/import/template` | OWNER | download XLSX |
| POST | `/inventory/import/preview` | OWNER | multipart XLSX, validate only, returns `batchId` + expiry/results |
| POST | `/inventory/import/:batchId/commit` | OWNER | idempotent confirmed import with preview/hash/version checks |
| GET | `/categories` | OWNER, EMPLOYEE | POS filter |
| POST | `/categories` | OWNER | create |
| PATCH | `/categories/:id` | OWNER | edit |
| DELETE | `/categories/:id` | OWNER | soft delete if unused |

Example stock adjustment: `{ "delta": -2, "reason": "Damaged", "expectedVersion": 7 }`. For product numeric create/edit inputs, client defaults 0; server applies validation and decimal strings for prices.

## 4. POS / Payment / Receipts
| Method | Canonical endpoint | Roles | Notes |
|---|---|---|---|
| POST | `/sales/quote` | OWNER, EMPLOYEE | validate cart and return authoritative quote + optional PromptPay QR; no reservation |
| POST | `/sales` | OWNER, EMPLOYEE | atomic checkout + `Idempotency-Key` UUID, no double sale |
| GET | `/sales/by-idempotency-key/:key` | OWNER, EMPLOYEE | recover ambiguous result; only same org/allowed caller |
| GET | `/sales/:id/receipt` | OWNER, EMPLOYEE with sales access policy | **receipt snapshot JSON**, no printer command |
| POST | `/sales/:id/void` | OWNER | only within <=24h UTC; required reason; atomic stock restore |
| GET | `/payments/promptpay/config` | OWNER, EMPLOYEE | safe identifier/QR display config; do not expose private settings |

Quote request:
```json
{"items":[{"productId":"8bf9a91d-bae4-4920-a0d6-9278f2882fd0","quantity":2}],"discountAmount":"10.00","paymentMethod":"CASH"}
```
Quote response `data` contains `quoteFingerprint`, `items: [{productId,barcode,name,quantity,unitPrice,expectedVersion,lineTotal,stockAvailable}]`, `subtotalAmount`, `discountAmount`, `vatAmount`, `totalAmount`, `promptpayQrPayload` (if relevant). Price/qty is never reserved by quote.

Checkout request:
```http
POST /api/v1/sales
Authorization: Bearer <Supabase-Access-Token>
X-Client-Platform: WEB
X-Client-Version: 1.0.0
Idempotency-Key: 26f414c6-bd54-4e8f-bb39-8e690617423a
Content-Type: application/json
```
```json
{
  "items":[{"productId":"8bf9a91d-bae4-4920-a0d6-9278f2882fd0","quantity":2,"expectedUnitPrice":"45.00","expectedVersion":7}],
  "discountAmount":"10.00",
  "expectedTotalAmount":"80.00",
  "payment":{"method":"CASH","receivedAmount":"100.00"}
}
```
`201 data` (idempotent replay `200 data`):
```json
{
  "saleId":"a60145ad-ecbb-4df7-97c0-f198266ca8cf","saleNo":"SL-20261011-00001","status":"COMPLETED",
  "totalAmount":"80.00","receivedAmount":"100.00","changeAmount":"20.00",
  "receipt":{
    "receiptSchemaVersion":1,
    "saleId":"a60145ad-ecbb-4df7-97c0-f198266ca8cf",
    "saleNo":"SL-20261011-00001",
    "completedAtUtc":"2026-10-11T03:00:00Z",
    "store":{"name":"ร้านตัวอย่าง","footer":"ขอบคุณ"},
    "cashierName":"สมชาย",
    "items":[{"barcode":"000001","productName":"สินค้า A","quantity":2,"unitPrice":"45.00","discountAmount":"10.00","lineTotal":"80.00"}],
    "totals":{"subtotal":"90.00","discount":"10.00","vat":"0.00","total":"80.00","received":"100.00","change":"20.00"},
    "paymentMethod":"CASH","saleStatus":"COMPLETED"
  }
}
```
**Implementation note**: all HTTP responses use top-level envelope; `201 data` above is the body inside `data`. `GET /sales/:id/receipt` returns the same immutable `receipt` object as `data`, expanded with full store/VAT/payment snapshots; Web/Java/Mobile each render it locally.

PromptPay checkout replaces payment with `{ "method":"PROMPTPAY", "manualPaymentConfirmed":true }`. Cannot mark paid just because a QR was displayed. Stale quote/price returns 409 and must show reconcile warning, especially if customer already transferred.

## 5. Reports / dashboard / settings / audit
| Method | Endpoint | Roles | Notes |
|---|---|---|---|
| GET | `/settings/store` | OWNER | full settings |
| PATCH | `/settings/store` | OWNER | store, VAT, PromptPay, receipt footer |
| GET | `/settings/receipt-public` | OWNER, EMPLOYEE | receipt display details only, no secrets |
| GET | `/reports/sales?from=&to=&groupBy=&cashierId=` | OWNER, ACCOUNTANT | immutable sale snapshots; day/week/month/year |
| GET | `/reports/inventory` | OWNER, ACCOUNTANT | current inventory read report |
| GET | `/reports/low-stock` | OWNER, ACCOUNTANT | fixed <=5 |
| GET | `/reports/stock-valuation` | OWNER, ACCOUNTANT | qty x current unit cost |
| GET | `/reports/:type/export.xlsx?...` | OWNER, ACCOUNTANT | authenticated XLSX file stream, bounded; Excel formula escape |
| GET | `/dashboard/summary?from=&to=` | OWNER | aggregates only |
| GET | `/audit/products?productId=&page=` | OWNER | before/after logs |
| POST | `/audit/products/:auditId/reverse` | OWNER | `expectedVersion` + reason; compensating movement if qty |

## 6. HTTP resilience, compatibility and security
- `Idempotency-Key` required on checkout and recommended on other at-least-once risk mutations; persist org+action+key+request-hash transactionally. Identical replay = identical saved result. Different payload same key => `409 IDEMPOTENCY_CONFLICT`.
- Uncertain checkout (timeout/disconnect): **do not generate new key**; check `/sales/by-idempotency-key/:key`. `404` may be still processing: bounded backoff; eventual manual verify if ambiguous. Never auto-retry a charge or commit blindly.
- 401 -> refresh once via Supabase Auth public API; retry safe GET. For write calls, reconcile mutation status/idempotency before retrying. Revoked membership -> 403 and lock out even with valid JWT.
- Report XLSX returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` binary, not JSON envelope. Image upload `multipart/form-data` or server signed URLs, not embedded base64. Auth operations are external Supabase Auth (not `/api/v1/auth/login`).
- All routes rate-limited sensibly per identity/IP. Web allowed origins via allowlist, not `*` for sensitive response handling. `X-Client-Platform` never grants permissions.
- API version major: `/api/v1`. Within v1 only additive backward-compatible changes; incompatible change -> `/api/v2` with deprecation notice. Minimum supported versions can be advertised at `/client/config`; a desktop client should show upgrade prompt, not crash.
- Stable errors: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CART_STALE|VERSION_CONFLICT|BARCODE_EXISTS|IDEMPOTENCY_CONFLICT|VOID_WINDOW_EXPIRED` 409, `INSUFFICIENT_STOCK|INSUFFICIENT_PAYMENT` 422, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503.

## 7. Contract tests are release blocking
Generate/validate the TypeScript client and HTTP response schemas against `contracts/openapi.yaml` in Phase 1; Java models are deferred, exercise registered Org A/B and OWNER/EMPLOYEE/ACCOUNTANT, UUID/decimal serialization, expiry/refresh/revocation, concurrency/idempotency, exports, receipt snapshots, and 404/409/422 error behavior. Phase 1 acceptance is in `10_TEST_ACCEPTANCE.md`; `19_CROSS_CLIENT_TEST_PLAN.md` is future reference only.

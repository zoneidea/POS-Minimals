# KidTang LINE MINI App — isolated development entry

Authorized 2026-10-20: implement the first LINE web client without changing the working Web POS, existing API, database or authentication contracts. This is a web entry, not a Native App or a restaurant/table-ordering implementation.

## Entry and LINE Console handoff

- Web endpoint: `https://pos-minimals.vercel.app/line/` (trailing slash).
- Developing LIFF URL supplied by the owner: `https://miniapp.line.me/2012103465-KynjquiS`.
- Developing LIFF ID: `2012103465-KynjquiS`, public configuration, not a credential. Optional build-time `VITE_LINE_LIFF_ID` overrides this development default.
- After deployment, set **Web app settings → Endpoint URL → Developing** to the web endpoint above. Leave Review and Published environments unchanged.
- Open the Developing LIFF URL in LINE with an authorized channel tester. Initial SDK load/init failures show an error and retry rather than silently skipping initialization.
- No Channel secret, LINE access token or new permission is needed in the frontend. Existing `profile` scope is not consumed by this slice.

The client loads LINE's official CDN SDK only from this entry and awaits `liff.init()` before loading the application. It preserves LINE query parameters during initialization. See [official LIFF initialization requirements](https://developers.line.biz/en/docs/liff/developing-liff-apps/#initializing-liff-app).

## Isolation and supported workflow

Separate `line/index.html`, `line-main.tsx` and feature components/styles; the legacy `App.tsx`, `main.tsx`, POS, API, contracts and migrations are unchanged. Vite adds an HTML build input. Vercel adds one exact `/line/?` mapping after the existing API/filesystem/internal rules; existing public/internal routes remain intact. LINE content is noindex and absent from Sitemap.

1. Initialize LIFF, then sign in with the existing KidTang email/password.
2. Load verified store/role and daily session policy through the existing API. Owner and employee can sell; accountant is directed to existing Web reports, with server authorization still authoritative.
3. Browse/search/filter the catalog, add products, open the cart. An exact barcode already loaded uses the same immediate add logic; otherwise the existing exact barcode API is used.
4. Cash checkout obtains the server quote, supports manual discount and coupon when entitled, requires accepting changed prices, and uses the existing atomic cash sale API.
5. Show the immutable digital receipt, start a new cart, or view today's existing sales/receipts.

LINE identity is **not** automatically linked to a store/user. The dedicated Supabase client uses `kidtang:line:auth:v1:<project>`, `detectSessionInUrl:false`, and local sign-out. It does not read, overwrite or log out the existing Web client's storage/session. Its own midnight expiration event is distinct from the legacy event. Server-side membership/role/session checks remain unchanged for every protected request.

Cart and pending-sale storage keys include user ID + organization ID. A pending cash operation is durably saved before sending. Ambiguous network/auth/server errors retain its key and immutable payload; recovery looks up that key, and a not-found result resubmits only the same operation/key. Pending operations block another checkout/navigation in this client. The application does not assume that a failed network response means a sale failed.

## Existing API integration contract (unchanged)

All requests use `/api/v1`, bearer JWT, `X-Request-ID` and existing `X-Client-Platform: WEB`. JSON success/error envelopes and pagination retain their existing meanings. No new server routes, role grants, CORS changes, schema changes or RPCs.

| Existing route | Request / response used by this client |
| --- | --- |
| `GET /auth/me` | User/store IDs, store name, username, role, permissions |
| `GET /auth/session-policy` | `{expiresAt}`; fail closed if policy is unavailable |
| `POST /auth/logout` | Revoke this authenticated session; local LINE Auth sign-out |
| `GET /products` | `page`, `limit=10`, optional literal `search`, `barcode`, `categoryId`; `{items,total,page,limit}` |
| `GET /categories` | `page`, `limit=10`; `{items,total,page,limit}` |
| `GET /marketplace/entitlements` | Existing `{coupons}` flag |
| `POST /sales/quote` | `{items:[{productId,quantity}],discountAmount,paymentMethod:'CASH',couponCode?}`; server fingerprint/items/prices/versions/stock/totals/VAT |
| `POST /sales` | Existing `Idempotency-Key`; `{items:[{productId,quantity,expectedUnitPrice,expectedVersion}],discountAmount,couponCode?,expectedTotalAmount,payment:{method:'CASH',receivedAmount}}`; completed sale + immutable receipt |
| `GET /sales/by-idempotency-key/:key` | Existing completed operation or not found; never replace key after ambiguous failure |
| `GET /sales?page=N` | Existing current Bangkok-day sales, ten rows/page |
| `GET /sales/:id/receipt` | Existing **`{status,sale,...}` envelope**, with completed sale snapshot under `sale` |

All amounts remain decimal strings; local display uses existing BigInt helpers. The client sends no trusted `org_id` and never directly modifies stock. Zod validates responses; the existing backend recalculates totals and enforces tenancy, stock, permissions and idempotency.

## Diagnostics and limits

Metadata-only local diagnostics (request ID, sanitized route, status, duration, event, timestamp) are capped at 100 entries and pruned to 30 days on append. No tokens, email/password, bodies, profile, receipt or cart data is logged. Existing server audit/log retention is unchanged.

This slice intentionally supports **cash + digital receipts**. It does not implement LINE account linking, signup/recovery inside MINI App, Payment Gateway, receipt printing/Print Agent, camera scanning, offline sale completion, stock administration, restaurant tables or customer self-ordering. Barcode input is typed/external keyboard input. Existing browser links open the unchanged Web application and may require its own login.

## Verification and acceptance

- TypeScript checks and production build; separate LINE HTML/chunk, original prerendered public/internal HTML retained.
- Unit/adapter tests: SDK config/init/timeout/retry; own Auth storage; existing URLs/headers/payloads; own daily-expiry event; strict decimal response parsing; durable operation/key recovery; storage failure prevents POST; pending retained for ambiguous auth/network/server errors; legacy source isolation.
- Browser QA uses a **temporary external fixture**, with fake Auth/LIFF/API only in the test server, never shipped. At 390×844: login → catalog → two items → refresh retains cart → cash 32/50/change18 → one confirmed fixture bill → digital receipt → new empty cart → sales → view bill. Console has no relevant errors/warnings.
- Mocked browser QA does **not** prove a real LINE WebView, live Supabase login/session expiry, multi-device stock concurrency or a real financial transaction. These remain on-device UAT after setting the Developing endpoint. No production sale was created by this QA.
- Regression checks run from an isolated Git snapshot including the baseline tests; existing local test deletions are not restored, staged or committed.

Rollback: revert this additive feature commit to remove the LINE entry/config rule. No database rollback or API migration is needed. Restore Developing endpoint in LINE Console separately if it was changed.

Final automated gate: **94 test files / 449 tests passed** in the isolated baseline+feature snapshot with `--maxWorkers=2` (93.07 s); typecheck and production build passed. An initial unrestricted run exceeded local resource/time limits; retrying with bounded workers passed after restoring original route ordering. Built dependency traversal from `LineApp` reaches neither the legacy `client-*` Auth chunk nor Print Agent/receipt-print chunks. Public landing, `app.html` and internal POS HTML remain generated.

## User acceptance — 2026-10-20

The owner confirmed: **“ทดสอบบน LINE จริง Pass”**. Real LINE on-device UAT is accepted for this delivered development slice. This is user-reported acceptance, distinct from the earlier mocked browser checks. No device/OS breakdown or separate expiry, multi-device concurrency, live transaction or printing results were supplied; those specific scenarios are not independently asserted by this record. Existing Web POS/API/DB contracts and the cash/digital-receipt feature scope remain unchanged.

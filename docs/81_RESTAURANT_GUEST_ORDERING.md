# Restaurant guest QR ordering — implementation

Status: implementation approved by the user. Web/API/SQL implemented; release verification is recorded below.

## Acceptance and scope

1. OWNER/EMPLOYEE opens a restaurant table using the existing confirmation flow, then displays or prints a QR for that open bill.
2. Scanning opens a mobile-first `/order/` menu without a staff account. It displays shop/table, categories, available products and prices; options, quantity and item notes reuse existing menu rules.
3. Customer reviews the cart and confirms sending. The server validates current prices/options/availability and appends a round to the same open bill. The customer sees acknowledgement and can order another round.
4. POS receives confirmed rounds through its existing board refresh. Staff can print the preparation ticket; guest clients cannot access a printer, staff routes, checkout or payment APIs.
5. Existing cash Checkout remains the only restaurant payment flow. Successful cash settlement or bill cancellation makes the guest link unusable. A subsequent visit gets a new token even for the same table.

Out of scope: guest payment/PromptPay, accounts/LINE login, kitchen status, table merging, split payment, reservations and automatic acceptance status workflows.

## Approved authentication boundary

The existing `/api/v1` daily-session middleware and restaurant RPCs require a staff identity. Guest access needs an isolated token-authenticated API boundary and a public entry point; a guest must never impersonate the staff member who opened the table. Existing signatures, role guards, daily sessions and tenant checks must remain intact.

Use a cryptographically random per-bill capability token, derived with a domain-separated HMAC-SHA256 from a random visit ID and the existing server-only snapshot key; only its hash and visit metadata are persisted. Place the bearer in the QR URL fragment, remove it from the visible URL after local capture, and transmit it only through Authorization headers over HTTPS. The token grants access only to that open bill's public menu and order operations. Do not encode credentials, email, telephone or a staff session in the QR. No token in logs, query strings, analytics or referrer headers; guest entry is noindex/no-store with a strict referrer policy. The guest page must bypass staff analytics initialization.

Token lifecycle: issued only by scoped staff operation for an open bill; revocable/rotatable by staff; expiry on close/cancel and after 24 hours. Repeated QR display should reuse the active visit token without creating a second guest session. Secure rotation must invalidate old requests. Persistent storage must survive Vercel restarts; no in-memory authority or idempotency.

## API contract

All responses retain `{success:true,data:...}` or the existing error/requestId envelope.

| Endpoint relative to `/api/v1` | Authentication | Input / result |
| --- | --- | --- |
| POST `/restaurant/bills/:id/guest-access` | Existing staff Bearer | Issue/read the scoped active visit link; result `{url,expiresAt}` |
| POST `/restaurant/bills/:id/guest-access/revoke` | Existing staff Bearer | Revoke active link with optimistic version; `{revoked:true}` |
| GET `/guest/restaurant/menu` | Guest Bearer | Public shop/table identity, categories, products and applicable options; excludes costs, private settings and staff identities |
| GET `/guest/restaurant/order` | Guest Bearer | Current open-bill food rounds/totals and revision, excluding payment/private identity data |
| POST `/guest/restaurant/orders` | Guest Bearer | `{key,version,items:[{productId,lineId,quantity,optionIds,note,expectedUnitPrice}]}`; confirmed round acknowledgement and new bill revision |

Staff APIs retain daily-session checks. Only the exact guest route group uses guest capability validation instead; unknown paths remain denied. No payload accepts tenant/table ownership overrides, captured snapshots, discounts, coupons, payment or privileged operations. Existing snapshot and option-pricing logic should be shared through a private scoped core, with unchanged staff wrappers; never set a fake `auth.uid()` for a guest.

## Persistence, abuse protection and transactions

Add versioned initializer migrations for visit-token hashes/expiry/revocation and durable request identity/rate-limit metadata. Deny direct client writes and ensure RLS/least-privilege RPC grants. Guest activity records identify the source as guest; avoid attributing the customer action to a staff user. Existing staff round schema has a non-null staff creator: support an explicit guest source rather than recording a false cashier identity.

Enforce durable per-token submission throttling (6 sends/minute, 120 reads/minute), per-client protection (180 requests/minute), 50 lines/request and 20 units/line; do not rely on Vercel-instance memory. Limits must apply in the database boundary as well as HTTP, including callers bypassing the Express endpoint. Return 429 with retry guidance.

Serialize with the existing org/bill lock order. Validate token state and bill status inside the order transaction. Prices/options and names are snapshotted on the server; stock remains checked at send and deducted only at settlement, as today. Preserve round/line limits. Duplicate request key plus identical body returns its original acknowledgement exactly once; changing the body conflicts. Persist pending requests on the guest device and resolve unknown results with the original key before allowing a fresh submission. Concurrent send, cancellation, token rotation and checkout must not append to a closed bill.

## Printing

Printing remains a staff-side responsibility. Guest browsers cannot reach the restaurant's loopback Print Agent. Confirmed guest rounds must appear distinctly in POS history with explicit preparation-ticket printing/reprinting. Automatically printing received rounds needs durable claim/acknowledgement across POS devices to avoid duplicate tickets; include it only after its lifecycle is reviewed, and never claim that delivery is guaranteed when no staff POS is open.

## Required proof before release

- HTTP: guest/staff boundary, strict payloads, expiry/revocation, rate limits and safe logging.
- Isolated database: two-tenant isolation, no direct writes, no fake staff identity, duplicate submissions, changed body, stale price/options, rollback, round limits, close/rotation races and immutable snapshots.
- Browser fixtures: QR entry on mobile, categories/options/notes/cart, double-tap prevention, unknown-response recovery, new round visible on POS, expired/closed visit states, responsive/dark layouts.
- Re-run existing cash/cafe/restaurant/SSO/contracts/build gates. Apply additive migrations only to the confirmed development target, then deployment preflight and live health checks.
- User acceptance on two real devices and physical printer is separate; fixture tests do not prove real concurrency or hardware printing.

Rollback: disable new guest entry/issuance while retaining token/order/audit history; legacy staff ordering and cash settlement continue to work. Do not drop historical rounds.

## Implementation details and compatibility

- `202610230005_guest_pricing_core.sql` extracts the existing stock/options calculations into private tenant-scoped cores, with unchanged staff wrapper signatures and explicit staff membership guards. Guest code never changes `auth.uid()` or impersonates a staff account.
- `202610230006_restaurant_guest_access.sql` adds hashed visit capabilities, server-only rate counters and guest activity logs. Rounds carry additive `source`/`guest_access_id`; only GUEST rounds may have a null staff creator. Existing STAFF rounds retain their creator invariant. Existing 30-day log cleanup also purges guest activity, while confirmed round/bill history is retained.
- `202610230007_restaurant_guest_orders.sql` grants the guest RPC only to `service_role`. Anonymous/authenticated direct RPC/table access is denied; Express validates the guest capability and forwards a hash through its server-only Supabase client. Durable rate counters commit even when an inner order transaction is rejected.
- The visit token is carried in the QR fragment, captured into tab session storage, removed from the address bar, and sent only in Authorization headers. Cart and pending-request keys use a SHA-256 digest. No staff Auth SDK, staff analytics initialization, payments or Print Agent is imported into the guest entry.
- `/order/` uses its own Vite entry. The build places its HTML at `guest-order.html` so the dedicated no-store/no-referrer/noindex rewrite runs after existing filesystem handling; existing API/private/LINE route order remains intact.
- Product responses contain availability rather than internal stock/cost/cashier data. Signed images are generated only after validating the current visit; options, quantities, notes, totals and historical rounds are rendered with existing components where appropriate.
- POS displays guest rounds in the cart and offers explicit preparation-ticket printing by round. This release does not automatically print incoming rounds or guarantee delivery while the staff POS is closed. Physical printer validation remains separate.
- Browser pending requests survive reload. Unknown results, expiry, throttling or conflicting identities do not generate a replacement key. Confirmed results clear persisted cart data before clearing the pending marker; storage failure keeps the original request recoverable.

## Validation evidence

- Isolated SQL: token/tenant isolation, no client grants, truthful guest source, price validation, required options, snapshot retention, retry once, unchanged stock before settlement, rate limits across rejected requests, expiry/revocation and closure.
- HTTP: guest routes bypass only the staff daily-session boundary, exact unknown/staff paths remain protected, strict DTOs reject tenant/payment/snapshot injection, staff-only issuance and 429/410 behavior.
- Browser on isolated PGlite + actual Express routes and React pages: issue QR from POS, open mobile guest menu, options/note/quantity, 80 THB round visible in POS, simulated committed response loss then reload/recovery to exactly 90 THB/two rounds, explicit mock preparation print, staff settlement releases table and expires the customer menu. Mobile width 390px has no horizontal overflow and the token fragment is removed. No real shop/customer/payment/printer data was used.
- Full suite initially identified route-order regressions, which were fixed without weakening existing assertions. A daily-session test timed out during host load and passed when isolated with its original timeout. Final gate/deployment outcomes follow the release log.

### Release gates — 2026-10-23

- Final full regression gate: 120 files / 540 tests passed; final TypeScript check and workspace production build passed.
- Applied additive migrations 005–007 to the confirmed development database. Remote inspection verified guest RPC service-role-only execution, authenticated-only staff issuance, no exposed private pricing cores, token-table RLS/no authenticated SELECT, and guest-log RLS with owner-scoped reads.
- Protected immutable Vercel preflight passed: health 200, invalid guest capability 410, and `/order/` 200 with no-store, no-referrer and noindex/nofollow headers. Existing unknown API routes remain staff-protected.

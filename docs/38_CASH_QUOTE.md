# Read-only cash quote

Implemented `POST /api/v1/sales/quote` for authenticated active OWNER/EMPLOYEE membership. Cash quotes read current product price, stock/version and shop VAT settings from PostgreSQL. They do not reserve stock, modify inventory or create sales. ACCOUNTANT/anonymous/suspended callers cannot quote. PromptPay currently returns `409 PAYMENT_UNAVAILABLE`; QR integration remains pending.

## Contract

Input: `{items:[{productId,quantity}],discountAmount:"0.00",paymentMethod:"CASH"}`. Strict keys, 1–200 unique products, integer quantities 1–2147483647, fixed two-decimal nonnegative discount (up to 12 integer digits). No client price or tenant accepted. Reject unavailable/deleted/other-shop products, insufficient stock, discount above subtotal and total above supported money range.

Output envelope contains `quoteFingerprint`, current item snapshots `{productId,barcode,name,quantity,unitPrice,expectedVersion,lineTotal,stockAvailable}`, `subtotalAmount`, `discountAmount`, `totalAmount`, `vatAmount`, `vatEnabled`, `vatRate`, `promptpayQrPayload:null`. Money is decimal text. Inclusive VAT = round(total × rate/(100+rate), 2); off = zero. Fingerprint is a change marker, not a signed authorization or stock reservation.

Canonical OpenAPI/document copy/generated types updated. Existing safe request metadata logs apply; item payloads and auth tokens are not logged.

## Database

Migration `202610120005_cash_quote.sql` adds the narrow security-definer `quote_cash_sale` projection: organization/role derived from `auth.uid()` and active membership/organization, direct cost/settings access still governed by existing RLS. It returns no cost or personal settings. PUBLIC/anon cannot execute; input validation also exists in SQL. No existing migration changed. Applied to the user-confirmed development Supabase. Rollback feature exposure by removing the route/client and revoking RPC execution; preserve migration history and inventory data.

## Checkout behavior

Cash Modal requests a quote on open and after quantity/discount changes (300ms debounce), and on window focus. Old quote becomes unusable when inputs change, leaving money change/Exact without a valid due until a response arrives. In-flight requests abort on closing/changing inputs. Errors show a retry action. Price differences from the saved cart show current names/prices and require explicit acceptance before using the due amount. VAT uses returned shop data. No automatic retry of sale writes; quote POST is read-only.

## Evidence and remaining work

Typecheck, build and 167 tests across 18 files pass. HTTP tests cover authentication, owner/employee/accountant roles, unsupported PromptPay, duplicate/empty/injected/invalid input. Isolated PostgreSQL verifies tenant separation, suspended/anonymous rejection, latest prices, insufficient stock, discount limits, VAT rounding and unchanged stock/version after quoting. Browser verifies empty-cart Modal and no console errors. Actual shop remains empty; hosted populated quote UAT is pending without inserting fake products into the user's inventory.

`POST /sales` atomic checkout, quote/checkout reconciliation, idempotency recovery, payments, sales snapshots and receipts are the next slice. Final confirm stays disabled until that transaction exists. Quotes can become stale immediately due to concurrent sales/settings/product edits; checkout must always revalidate and recalculate inside its transaction.

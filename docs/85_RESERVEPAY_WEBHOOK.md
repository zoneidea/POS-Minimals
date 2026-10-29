# ReservePay signed payment webhooks — 2026-10-29

## Dashboard setup

- Destination URL: `https://posjung.com/api/v1/webhooks/reservepay`
- Events: `PAYMENT_COMPLETED` and `PAYMENT_EXPIRED` (payload names `payment_completed` and `payment_expired`)
- Signature type: `HMAC_SHA256`
- API version: `2025-04-01`
- Copy this webhook endpoint's Base64 `verification_key` into the Vercel Production secret `RESERVEPAY_WEBHOOK_VERIFICATION_KEY`. This is distinct from `RESERVEPAY_API_KEY`; never put it in Web code, URLs or chat.
- Redeploy after adding the Production secret. The endpoint returns 503 until configured, so ReservePay can retry rather than falsely acknowledging an unverified event.

## Processing contract

1. Express reads the raw JSON bytes (16 KB limit), verifies `Reservepay-Signature: hmac_sha256=<hex>` against the Base64-decoded endpoint key, then validates the payload. No POS login token is accepted as webhook authority.
2. Resolve the existing `pay_` payment to its bound session and organization. `external_id` is optional in webhook payloads; if supplied it must match the `pos_<session hash>` binding. Unknown POS payment references return 503 so ReservePay retries after initiation finishes persisting the reference.
3. Recheck `find-payment` with the server-only merchant key. Check provider payment ID, `external_id`, amount, currency, method and fees against the stored session before any sale mutation. The payload's status is only a notification, not proof of payment.
4. Record the event ID and provider result for audit (30-day retention). For SUCCESSFUL with `captured_at`, persist fee/time proof and invoke the existing atomic gateway sale RPC via a service-role-only wrapper that acts as the original cashier. Duplicate deliveries and concurrent POS confirmation replay the same sale. If checkout cannot complete, return 503 for retry and keep the paid session reference.
5. EXPIRED, FAILED and PENDING do not post a sale. A late SUCCESSFUL result still posts if ReservePay's current status is successful. An EXPIRED event alone never makes a photographed QR invalid at the bank.
6. POS keeps the existing SDK polling and 5-second backend confirmation while a QR is visible or after its deadline. A sale posted by the webhook is returned by the existing confirmation endpoint; SDK failure and network errors retain the original payment reference and prevent duplicate collection.

No QR lifetime is created or extended. No QR is recreated automatically. This integration has no provider-side cancellation API. Public unauthenticated webhook calls cannot supply a tenant ID or post sales without a valid HMAC and independent provider verification.

## Release checks

- Migration `202610290001_reservepay_webhooks.sql` must be applied before enabling the webhook endpoint in the Dashboard.
- Configure the verification key after the endpoint is created, then redeploy.
- Run a ReservePay test-account event for both EXPIRED and SUCCESSFUL and check that duplicate delivery yields only one sale and the POS receives the posted receipt. Live bank rejection of an old photographed QR requires provider-side validation; UI hiding alone does not prove it.

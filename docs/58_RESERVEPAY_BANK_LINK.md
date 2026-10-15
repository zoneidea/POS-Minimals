# ReservePay bank-account link — 2026-10-14

After an OWNER successfully saves Gateway bank settings, backend reads the persisted encrypted payment settings and saved shop name, then POSTs to `https://api.reservepay.com/merchants/link-bank-account`.

Headers: Content-Type/Accept application/json, Api-Version 2025-04-01, Authorization Bearer server-only RESERVEPAY_API_KEY. Exact JSON payload: `{contact_id: orgId, bank_code: selectedThreeDigitCode, number: savedFullAccountNumber, name: savedStoreName, country_code: "TH", primary: true, external_id: orgId}`. Both IDs use the verified local store ID as explicitly requested by the user; no undocumented provider-ID mapping is assumed. User confirmed add-contact UAT Pass before this slice.

## Security and save semantics

- Account linking runs only in the owner-only PATCH /api/v1/settings/payments flow for GATEWAY mode, after save_store/payment RPC succeeds. Accountants remain read-only; employees never receive bank fields. No bank-link endpoint accepts a caller-specified organization ID.
- Read back the persisted version; if another save overtook it, return UNKNOWN rather than link the wrong account. Raw account is decrypted only on backend and is not included in API responses, logs, source or ledger. Browser retains masked views and blank replacement fields.
- Local save remains successful when external linking fails. API response keeps `{version}` and adds optional `bankLinkStatus: PENDING|SENT|FAILED|UNKNOWN|NOT_CONFIGURED`. UI distinguishes saved bank data from successful ReservePay HTTP submission. Gateway availability remains false; linking does not implement charges or payment confirmation.
- Durable claim precedes POST. Ledger uniqueness is organization + keyed HMAC fingerprint of saved version/bank/account. Retry of the same saved version does not resend. A later explicit save is a new request and may set another primary account, including switching back to a previously linked account.
- A partial unique index permits only one PENDING/UNKNOWN link per shop, preventing overlapping primary-account changes. Uncertain previous linking requires provider review before changing another account.
- Timeout 8 seconds, redirects rejected. 2xx → SENT (HTTP success only), non-2xx → FAILED with bounded redacted diagnostics, network uncertainty → UNKNOWN. Never automatically retry uncertain outcomes; check provider state before any manual retry.

## Database and verification

Migration 202610140006 creates service-role-only RLS-enabled reservepay_bank_links. Metadata contains org ID, non-reversible keyed fingerprint, request UUID, state, HTTP status, timestamps and redacted diagnostics; no account number, key or name. Saved bank details remain encrypted in existing payment settings. DatabaseInitializer applies the migration; the operational ledger preserves same-save deduplication independently of 30-day request logs.

Mocked tests cover exact payload/headers, claim-before-send, same-save duplicate suppression, redacted provider errors, unavailable configuration/ledger and uncertain network outcomes. Existing payment settings tests cover owner-only writes, accountant/employee rejection, encrypted bank persistence and masked responses. Live linking is not attempted with invented bank data; user must save their real Gateway bank settings and verify ReservePay's linked account.

Account holder name: payment configuration now accepts `accountName` (trimmed, at most 150 characters); GATEWAY saves require a nonempty value. The name is encrypted in the existing payment-settings cipher, so no database migration is needed. Existing encrypted records without the field read as an empty name and require owner completion before the next Gateway save. GET exposes it only to OWNER/ACCOUNTANT; employees receive no account-holder information. ReservePay `name` comes from the persisted accountName, replacing store_name. The contact registration API still uses the store name. OpenAPI and generated contracts include the new field. Focused tests verify encrypted storage, role-limited reads, required-name validation and persisted-name bank sync (13 tests passed with bank-link tests).

## Owner bank unlink (2026-10-15)
`POST /api/v1/settings/payments/unlink-bank` accepts only `{version}`. Authenticated OWNER is required; caller-supplied shop/bank IDs are rejected. Server calls ReservePay `/merchants/unlink-bank-account` with `{contact_id: context.orgId, bank_account_id: context.orgId}` and the existing server-only bearer key/API version. The existing durable bank ledger serializes link/unlink operations and suppresses duplicate/uncertain sends using an operation-specific fingerprint. No automatic retries or live QA bank removals.

Only confirmed 2xx plus successful ledger persistence permits local soft deletion: encrypted bank data is retained with `bankDeleted`/`bankDeletedAt`, hidden from subsequent reads, and GATEWAY switches to DISABLED. Re-adding requires a new account number. Existing versioned settings RPC records actor/request/time in activity audit. Provider failure/timeout/configuration failure preserves local account data; if local optimistic update conflicts after provider success, the API explicitly requires reconciliation. The same-version retry can reuse a recorded SENT outcome without resending. No database migration or hard delete is introduced.

UI shows the red trash button only to owners when a saved account exists, with SweetAlert confirmation, 1.5-second success and warning on failure. Accountant access remains read-only. Unsaved form edits are not submitted by removal; the bank operation uses the saved version.

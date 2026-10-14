# ReservePay merchant contact — 2026-10-14

After successful authenticated store bootstrap, Express posts the persisted store contact to `https://api.reservepay.com/merchants/add-contact`. This is a contact integration only: no charge, account verification, settlement or Gateway payment confirmation is implemented.

Headers: Content-Type/Accept application/json, Authorization Bearer server-only RESERVEPAY_API_KEY. Key is configured in ignored local environment and Vercel Production Secret; it is never included in browser bundles or logs.

Payload: `{external_id: savedOrgId, contact_email: verifiedSignupAccountEmail, contact_mobile: savedStorePhone, contact_name: savedStoreName, favorite:false}`. Organization ID comes from the database bootstrap result. Store name/phone are read back from saved settings, with phone decrypted on the backend; changed retry form fields cannot substitute the saved contact. Email comes from verified Supabase Auth identity, not an email supplied in the HTTP body. Contact data is transmitted to ReservePay under the user's explicit instruction.

## Delivery and local success

Additive migration 202610140004 creates a service-role-only `reservepay_contacts` operational ledger keyed uniquely by organization ID. This stores only state, request UUID, timestamps and HTTP status; no email, phone, name, request body, response body or credentials. Ordinary authenticated and anonymous roles cannot read/write it. Service-role usage is confined to integration status for the organization produced by verified bootstrap; ordinary store provisioning retains the user's JWT/RLS.

Atomic insert claims the organization before POST. Duplicate/concurrent bootstrap requests do not resend. Network timeout is eight seconds, redirects are rejected to prevent credential forwarding. 2xx HTTP records SENT; a non-2xx records FAILED; network failure or uncertain ledger completion records UNKNOWN. SENT indicates HTTP success only; provider response semantics were not supplied and are not invented. Do not automatically retry FAILED/UNKNOWN/PENDING: check ReservePay by external_id before any future manual resend. An interrupted process can leave PENDING; this remains safe against duplicate sends. These operational deduplication records are retained for the store lifetime, independently of 30-day diagnostic log retention.

Local store creation succeeds independently of delivery. Bootstrap response keeps `{orgId,role,status}` and optionally adds `reservePayStatus: PENDING|SENT|FAILED|UNKNOWN|NOT_CONFIGURED`. Failed/uncertain sync displays a store-created warning and an Enter Store button rather than encouraging duplicate registration or claiming the store save failed. External failure does not delete the store, owner membership or audit.

## Verification

Focused mocked HTTP tests verify exact destination/body/headers, saved organization ID, single submission, duplicate suppression, HTTP rejection, timeout, missing configuration and unavailable ledger. No synthetic merchant contact is created on the external production API. Live verification requires creating a real new shop and checking ReservePay's contact record; no automatic payment flow is covered.

## Redacted error diagnostics — 2026-10-14
Migration 202610140005 adds service-role-only diagnostic JSON. Failed HTTP responses are read up to 16 KiB, retaining only allowlisted error/message/code fields with capped depth/count/length. Submitted identity/contact fields, credentials, email/telephone patterns and Bearer tokens are redacted. Non-JSON or oversized responses retain a generic diagnostic, never raw bodies. Existing duplicate suppression remains; no automatic replay is introduced.

One user-authorized diagnostic probe of the known HTTP 400 rejection returned error code UNAUTHORIZED and message "You're not authorized to access this service". The server credential or its API permissions must be corrected before another attempt; no merchant success is claimed. The previous raw response was not retained and cannot be recovered. Diagnostic details accompany the operational record; contain no plaintext contact values.

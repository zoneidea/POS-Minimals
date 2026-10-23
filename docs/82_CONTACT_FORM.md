# Landing contact form / Resend

Public contact is a separate boundary before staff session enforcement. It is intentionally available without staff credentials; no existing staff API, role, session or tenant behavior is changed. The owner chose Resend for delivery to `dev@zoneidea.co.th`.

## Configuration

Server only: `RESEND_API_KEY` (send permission), `CONTACT_EMAIL_FROM` (verified Resend domain). Existing `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `SALE_SNAPSHOT_KEY` are required for abuse prevention. Missing configuration disables submission; the public email link remains available. Configure Production and redeploy. No dependency or database migration is required.

## Contract

- `GET /api/v1/contact/config` → `{success:true,data:{enabled:boolean}}`; no credentials disclosed. Browser starts disabled and enables only after this response.
- `POST /api/v1/contact`, JSON, same-site allowed `Origin`, required UUID `Idempotency-Key`. Body: `name` 1–100 characters, `email` valid address up to 254, `subject` 1–150, `message` 10–3000; optional `website` honeypot must be empty. Additional properties and header-control characters in name/subject are rejected. There is no client-selected recipient or From address.
- `202 {success:true,data:{accepted:true}}` means Resend accepted the message, not proof of inbox delivery. `400` invalid input; `403` disallowed/missing origin; `429` send limit; `503` unavailable configuration/limiter; `502 CONTACT_SEND_UNCONFIRMED` provider rejection, timeout or unknown outcome. Standard API error envelope and request ID apply. No automatic retries.

Sender is the configured verified address; recipient is fixed; visitor email is Reply-To. Plain text content avoids HTML injection. Resend's idempotency key is `contact/{UUID}`; browser retains the same key for an unchanged message after uncertain results and rotates after edits or success. Resend deduplication is time bounded (24 hours), not permanent exactly-once delivery. The browser holds form values only in component memory, disables duplicate clicks, preserves input on errors and shows the existing 1.5-second SweetAlert2 success dialog after acknowledgement.

## Abuse and privacy

One atomic Redis script limits each IP to 5 attempts per 10 minutes and all contact traffic to 100 attempts per rolling 24-hour window. Retries count as attempts. These are conservative initial limits, not throughput guarantees. Vercel's overwritten `x-vercel-forwarded-for` supplies the client address; local development uses the socket address. IPs are HMAC-hashed using a domain-separated existing server secret. Redis stores only hashes/counters and expiry times, in its own namespace; no contact content, email, or staff cache entries. Limiter failure closes delivery. Honeypot and origin checks supplement limits; Origin is not authentication and does not stop scripted clients. Add stronger bot challenges only if observed abuse requires it.

HTTPS to Resend/Upstash; no PII persistence in the application database. Existing request logs contain request ID/path/status/timing only, never message, address, key or provider response. Resend processes and may retain the submitted contact data under its configured retention policy. No automatic confirmation email to the visitor.

## Verification

`tests/contact.test.ts` covers public vs staff route separation, input/recipient injection rejection, fixed recipient/Reply-To, hashed limiter keys, rate rejection/unavailability, unavailable configuration, provider ambiguity and browser retry identity. `tests/landing-render.test.tsx` covers SSR copy; typecheck/build cover integration. Real-mail smoke test should use an explicitly labelled test message; provider acceptance and actual mailbox receipt must be reported separately.

Sources: [Resend send API](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel request headers](https://vercel.com/docs/headers/request-headers).

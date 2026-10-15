# ReservePay browser SDK on POS

Entering POS asynchronously loads `https://sdk.reservepay.com/js/v1/reservepay.js`
and calls `window.Reservepay.initReservepay` with public merchant ID
`636424799305` and installation ID `ins_ctd1FZtaDq`.

`apps/web/src/lib/reservepay-sdk.ts` shares one initialization promise and instance
per browser page, including concurrent calls and React StrictMode remounts.
Failures/timeouts (15 seconds) reject the promise; a later POS visit may retry.
The POS displays a nonblocking warning on failure and cash checkout remains usable.
The SDK is not loaded on unrelated pages before the first POS visit.

No API secret, bank details, authorization rules, checkout payloads or payment
confirmation behavior change. SDK initialization alone does not enable Gateway
payments. The fixed public installation is the one requested by the project owner;
per-store installation provisioning is outside this change.

Tests cover script URL/options, async loading, one-time initialization, failure
cleanup/retry and timeout. No real charge or bank mutation is performed.

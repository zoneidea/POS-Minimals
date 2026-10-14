# Payment settings — 2026-10-14

User-approved provider-independent settings: disabled, uploaded QR image or Payment Gateway. Gateway UI displays “เงินจะเข้าหลังจาก 1 วัน”; this is the requested product text, not a verified settlement promise. No provider, payment intent, bank verification, webhook or automatic settlement is implemented.

Owners edit `/settings`; accountants access the same route but see only the read-only payment section. Employees cannot access that page. Checkout obtains active-shop payment config and displays the uploaded static QR or the Gateway pending-integration state. Uploaded QR does not encode the checkout amount automatically. This slice displays QR but does not commit a PromptPay sale; existing atomic cash sale behavior is retained. Do not mark a transfer received or commit Gateway sales without a payment integration or separate manual-confirmation workflow.

## API contract

- GET `/api/v1/payments/config`: active authenticated membership required. `{mode: DISABLED|UPLOAD|GATEWAY, qrImage, gatewayReady:false, version}`. OWNER/ACCOUNTANT additionally receive `{bankCode, maskedAccountNumber}`; EMPLOYEE receives neither. No raw account number is returned to any browser.
- PATCH `/api/v1/settings/payments`: OWNER only. `{mode,qrImage,bankCode,accountNumber,version}`. Empty account preserves the stored number. A new bank requires re-entering account number. Gateway requires a supported three-digit bank code and 6–20 account digits; uploaded mode requires a PNG/JPEG data URL. Errors 400/401/403/409/503 use existing envelopes. Body/response data are excluded from metadata logs.
- Client upload accepts PNG/JPEG up to 5 MB, downsizes to 600 px and serializes to a raster data URL <=50,000 characters. Backend verifies actual raster decoding and rejects animation/invalid images. No SVG is accepted. QR content is not decoded or validated against a bank account; owner must test scanning the saved image.

## Database and permissions

`202610140003_payment_settings.sql` adds encrypted `payment_cipher` and separate optimistic `payment_version` to existing tenant-scoped store settings. All config and bank data use AES-256-GCM with server-only SALE_SNAPSHOT_KEY and domain AAD `pos:payment-settings:v1`. Read RPC resolves active tenant from auth.uid(); write RPC additionally requires OWNER, locks settings, validates expected version and writes an activity event without payment values. Ciphertext is readable only through authenticated tenant resolution; no decryption key is exposed. Existing contact encryption and sales are unchanged. Concurrent stale saves return 409. Retention follows existing 30-day application activity rules.

Mask example: `1234560123` → `xxx-x-xx012-3`. Owner replacement uses a blank password input; saved full value is never populated. Accountant gets masked read-only values and no save action. Settings always render loading/error/empty states and disable submission until load succeeds.

Bank codes follow the [Bank of Thailand reference list](https://www.bot.or.th/content/dam/bot/documents/th/statistics/dms/financial-market/14--%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%84%E0%B8%84%E0%B8%A5%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%AD%E0%B8%99%E0%B8%B8%E0%B8%8D%E0%B8%B2%E0%B8%95/ManualMCReport_V1.2.pdf). Dropdown is a supported-bank list, not a gateway availability guarantee. Obsolete standalone Thanachart code is omitted.

## Verification

Focused tests cover bank/account validation, encrypted roundtrip, masked owner/accountant responses, omitted employee bank data, authenticated owner writes, accountant/employee rejection, SQL tenant separation and stale versions. Existing locally deleted test files are not staged or restored. Browser verification uses isolated fixtures, not live bank/payment data. Real QR scanning, transfers, provider settlement and PromptPay sale completion remain outside this slice.

Typecheck/build and eight focused tests passed. Development migration applied and PostgREST reload requested. Isolated browser QA verified owner mode switching and save success, plus accountant disabled controls, masked number and absence of save button. Screenshot: /tmp/pos-payment-accountant.png (fixture data).

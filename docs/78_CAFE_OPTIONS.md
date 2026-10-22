# Cafe options, toppings and item notes — 2026-10-22

## Delivered scope

In CAFE mode an OWNER opens Store settings → ตัวเลือกเมนู / ท็อปปิ้ง. Create a reusable group, define its minimum/maximum selections, enabled/default choices and per-unit THB surcharge, then assign the group to one or more existing products. Groups and choices can be disabled; removed choices are soft-deleted. Historical bills remain unchanged. No Marketplace purchase is required.

POS opens a product dialog for cafe products. Required groups must be satisfied; optional single-choice groups have a clear selection button. Cashiers can enter a note up to 200 characters and quantity, then edit a cart line. Matching product/options/note/price merge; different variants remain separate. Notes apply to every unit in that line. Retail uses its existing direct-add flow. The isolated LINE client uses the same pure dialog/cart helpers through its own authenticated transport; SSO and LINE printing behavior are unchanged.

This release does not introduce ingredient/topping inventory, order types, tables, kitchen statuses or unpaid orders. Only the underlying product quantity is deducted.

## Additive API contract

All paths below are relative to `/api/v1`. The existing bearer-token authentication, active membership, tenant resolution, safe request/response logs and error envelope apply. Callers never supply orgId.

| Method/path | Permission | Data |
| --- | --- | --- |
| GET `/cafe/options` | Active member | `{storeMode,groups}`; cafe selling configuration only |
| GET `/management/cafe/options` | OWNER | All own groups, including disabled groups |
| POST `/management/cafe/option-groups` | OWNER | Create group input below; returns `{id,version}` |
| PATCH `/management/cafe/option-groups/:id` | OWNER | Same input plus current `version`; returns `{id,version}` |

Group input:

```json
{
  "name": "ท็อปปิ้ง", "minChoices": 0, "maxChoices": 2, "enabled": true,
  "options": [{"id": "<uuid>", "name": "เพิ่มช็อต", "price": "15.00", "enabled": true, "isDefault": false}],
  "productIds": ["<product uuid>"]
}
```

Group response includes id/version and the input fields. Limits: 200 groups/shop, 30 choices/group, 200 products/group, minimum 0–20 and maximum 1–20. Default choices must be enabled and cannot exceed maximum. Product/option IDs belong to this shop. Conflicting versions return 409; clients must reopen current data. Mutations record `CAFE_OPTIONS_SAVED` without logging request bodies or free-text notes.

Existing `/sales/quote`, `/sales`, Gateway initiation and receipt responses retain their routes. Optional item request additions are `lineId:uuid`, `optionIds:uuid[]` (unique, max 100) and `note:string` (max 200). Cash submission additionally sends `expectedOptionsFingerprint` from its quote. Rich line IDs are unique within the cart; old clients omit all additions.

Quote rows add optional `baseUnitPrice`, option snapshots `{id,name,groupName,price}`, note, optionIds, lineId and optionsFingerprint. `cafeSnapshot` is server-created quote data captured by Gateway preparation; public checkout input rejects this field. Never use caller-supplied prices/snapshots as payment authority. The shared cafe schema stays in TypeScript; `npm run contracts:generate` also emits its checked-in JavaScript runtime export for Node/Vercel packaging. CI checks both generated artifacts. Full request/response models and generated types are in `contracts/openapi.yaml` and `packages/contracts/src/generated.ts`.

## Pricing and payment

Server validates assigned/enabled groups and choices, minimum/maximum and product availability. Unit price = current base product price + selected per-unit surcharges. It applies manual discount and the existing capped coupon once per bill, then inclusive VAT under the existing shop configuration. Monetary calculation uses PostgreSQL numeric; the UI preview uses integer minor units. Quote/configuration version changes require a current quote; UI flags changed totals before cash confirmation.

Commit locks products in deterministic order, validates the quote and quantities summed across variants, then commits sale/payment, immutable line snapshots, one stock movement per product, coupon redemption and daily queue together. The aggregate movement preserves existing void's once-only stock restoration. Existing idempotency/recovery returns saved results; printing never resubmits checkout.

Gateway binds the server quote to the payment session and persists a trusted cafe snapshot before provider initiation. After payment, that snapshot keeps the charged topping prices/names even if an owner changes/disables them. Existing provider amount verification, pay_ reference, fee report and void protections remain. Product stock is still checked when committing; this release does not reserve stock on QR creation.

## Printing and customer display

Receipt, digital historical bill and receipt copy show saved options and notes; receipt shows option surcharges. Preparation ticket shows the same queue, product quantities, options and notes without prices. Names/notes are HTML-escaped. Original receipt then preparation use the existing sequential print path and Agent 1.1.2; no Agent update/protocol change is needed. The optional customer display includes bounded option/note text in its existing item-name field.

## Database and rollout

`202610220002_cafe_options.sql` adds three org-scoped configuration tables with RLS and owner-only direct reads, additive sale_items snapshot columns, narrowly granted public RPCs and private quote/commit helpers. Authenticated direct writes are denied. Cash callers cannot invoke the captured-price helper. Retail retains the original coupon/checkout core; cafe dispatch extends the existing store-mode wrapper. There is no new server or authentication mechanism.

Apply through DatabaseInitializer to the confirmed development Supabase target before deploying Web/API together. Existing shops, products, modes and historical sales are not rewritten and no group is automatically created. Roll back the app release while retaining additive data; if a cafe already has required groups, first disable those groups or switch the shop to RETAIL before running a pre-options client. Do not drop historical snapshots or edit migration checksums.

## Evidence and remaining UAT

- PGlite runs all migrations and covers owner/member/tenant isolation, direct-write/captured-price denial, required/invalid choices, combined stock, manual/coupon/VAT allocation, immutable receipts, Gateway snapshots after option edits, replay, stock/coupon void restoration.
- HTTP tests cover authentication/OWNER checks, strict payloads, duplicate lines, note bounds and forged snapshots. Pure cart/printing tests cover variants/merging, Gateway binding, escaping and price-free preparation.
- Full local suite passes 204 tests in 58 available files, followed by 7 passing focused checks including the added server-quote Gateway binding case; pre-existing locally deleted tests remain untouched. CI also passed the complete committed suite: 106 files / 485 tests.
- Browser fixture exercises actual settings/POS components, group creation, default selection, required-choice blocking, distinct variants, edit/quantity, cash checkout/cart reset and two captured print jobs. Mobile 390px light/dark layout and Console checked. Fixture data, mocked API and mocked Agent do not constitute real payment/printer evidence.
- Vercel packaging initially missed a TypeScript workspace runtime export; the generated JavaScript export fixes it. A production-environment deployment with domain promotion disabled returned health 200 before release. Existing domains were restored to the previous working deployment while investigating.
- Remaining user UAT: configure a real cafe menu, sell/void, verify actual thermal output and LINE on-device options. Concurrent multi-connection behavior is protected by PostgreSQL locks but single-connection PGlite does not prove concurrency.

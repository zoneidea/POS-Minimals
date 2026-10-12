# POS checkout panel and shared theme

> Payment controls subsequently moved into [Checkout Modal](37_POS_CHECKOUT_MODAL.md) per the user's latest instruction.

The user's latest instruction retains the POS product-grid/cart layout but restores the same theme as other screens. POS now uses shared primary/surface/border/text tokens, the standard header and icon rail, and both light/dark modes. The screenshot's red/green branding and takeaway/Delivery controls are superseded.

Read `04_UX_UI_SPEC.md` section 2 and `02_BUSINESS_RULES_WORKFLOWS.md` sections 2–3: the right panel is cart and checkout, not order fulfilment. Implemented unit-price/quantity/line totals from the existing draft, subtotal, fixed THB discount initialized to 0, prominent estimated payable, Cash/PromptPay selection, received amount initialized to 0, accumulating +20/+50/+100/+500/+1000 shortcuts, Exact/Clear/Backspace, decimal numpad, immediate change and insufficient-payment indication. All monetary calculations use bigint integer cents. Invalid discounts/received amounts are visibly rejected; no floating-point totals. Cash amount controls are 44px touch targets. Panel scrolls on shorter desktop screens; mobile keeps the existing stacked layout and page scroll.

## Remaining dependencies (explicitly pending)

Store settings/quote/atomic checkout APIs are not yet implemented. VAT is marked as awaiting shop tax data, not assumed to be 0 or calculated using a hardcoded rate. Estimated payable subtracts the discount from inclusive-price product subtotal; this is not an authoritative taxable quote. PromptPay displays no invented QR: it needs configured store identifier and a fresh server quote. Manual payment confirmation and final sale remain disabled. No bank confirmation is claimed. No sale/receipt/stock write occurs, and the cart is not cleared as though a sale succeeded. Draft cash/discount input is session UI state, not persisted payment data.

Future API work must implement the existing `/sales/quote` and `/sales` contract, fresh-price/stock reconciliation, stale-quote blocking, idempotency and receipt loading only after confirmed commit.

## Verification

Typecheck and build pass. Seven focused tests cover exact cents, invalid values, cumulative shortcuts, decimal/backspace input, stock bounds, removal and storage isolation. Hosted browser checks confirmed +20 then +50 = 70.00, Clear = 0, Cash/PromptPay switching, disabled manual confirmation/checkout, light/dark tokens, and mobile 390×844. Browser error logs returned no entries. No fixture products or payments were inserted into the user's shop.

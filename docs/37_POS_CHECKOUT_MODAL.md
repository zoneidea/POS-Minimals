# Compact cart and Checkout Modal

Latest user instruction supersedes the inline payment panel in `36_POS_CHECKOUT_PANEL.md`.

The right panel now contains selected product rows, item count/estimated subtotal and a Checkout button. Desktop width is 300px (320px above 1500px, 280px on tablets). A bounded flex layout keeps the summary and button fixed while only `.cart-lines` scrolls; the panel itself has `overflow:hidden`. Mobile retains a stacked 400px cart with the same independent list scroll.

Checkout opens the shared native-dialog Modal with payment method, fixed discount and estimated due, cash received, accumulating cash shortcuts, Exact/Clear/Backspace and Numpad. Change is displayed at 40px above the Numpad (36px on mobile). Modal closes through close button, back-to-cart or Escape and restores focus to Checkout. Draft payment inputs initialize at zero each time the Modal mounts; product cart persistence remains unchanged. Empty-cart review is allowed, with a visible message; final sale remains disabled.

Cash quote and VAT now use the [server quote](38_CASH_QUOTE.md); PromptPay QR and actual sale commit remain pending backend dependencies. No sale or stock write is introduced. No new API, database or permission change.

Evidence: typecheck/build and seven amount/cart tests pass. Browser verified opening/closing, +20 and +50 accumulating to 70.00, large change above Numpad, and the complete desktop Modal. DOM layout inspection confirmed 300px cart width, list overflow auto and panel overflow hidden. Hosted store remains empty; real long-list scroll and filled-cart checkout UAT remain pending. Screenshot: `/tmp/pos-checkout-modal.jpg`; cart `/tmp/pos-compact-cart.jpg` (local, not committed customer screenshots).

## Checkout completion override — 2026-10-17
After confirmed cash/Gateway sale commit (including recovery), close Checkout,
clear only the matching cart and automatically submit the original receipt. No
success or receipt Modal is shown; the next sale is immediately available. Print
status/errors appear inline. Printer errors never retry/reverse a committed sale.
Receipt copies remain available from Sales. See docs/55_PRINT_AGENT.md (1.0.4).

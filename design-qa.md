# Current POS QA — shared theme and specified checkout panel

Current visual target: user's latest instruction restores the shared app theme while preserving product-grid/cart layout. Right-panel source of truth: docs/04_UX_UI_SPEC.md section 2 and docs/02_BUSINESS_RULES_WORKFLOWS.md sections 2–3. The earlier restaurant screenshot is layout grounding only; red/green tokens and takeaway/Delivery no longer apply.

Implementation screenshot: /tmp/pos-shared-theme.jpg (1280×720 normal desktop). Browser checked mobile 390×844 and dark/light. Two-panel layout remains with an approximately 60/40 desktop split. Same header, ink icon rail, primary violet, neutral surfaces/text/focus states as other screens. Typography and spacing use the shared theme with compact payment typography and 44px cash controls. Actual shop is empty; no fixture product imagery inserted, placehold.co rule retained for missing assets.

Required surfaces: shared font/heading hierarchy; grid/cart spacing and scroll reachability; shared light/dark colors; existing product image handling; actual shop/category copy and explicit pending payment/VAT copy. Cash inputs are ordinary bordered controls with no raised/inset effects. Mobile stack preserved per the instruction to keep layout. This is not a claim of completing the entire checkout specification.

Interactions: +20 then +50 yields 70.00; Clear resets to 0; Cash/PromptPay changes panel content; manual payment and sale controls remain disabled without required backend data. Browser console error inspection returned no entries. Typecheck/build and seven focused money/cart tests pass. Populated cart, live VAT/quote/checkout and receipt UAT remain pending dependencies.

No actionable P0/P1/P2 layout findings remain in this UI scope. Actual VAT breakdown and QR are explicitly waiting for server settings/quote; no invented tax/payment data. Earlier image-clone report is superseded by this user-approved theme direction.

final result: passed

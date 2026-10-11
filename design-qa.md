# POS image-to-code QA

Source visual truth: `/tmp/codex-remote-attachments/01a129eb-31bc-7703-a57c-6b641f1308d5/48083230-222B-49DB-9F4E-0623236A23A3/1-Photo-1.jpg` (1280×607).
Implementation: `/tmp/pos-reference-layout.jpg` (1280×607); mobile `/tmp/pos-reference-mobile.jpg` (390×844). Browser CSS viewport matches those pixel dimensions, 1:1 density, no browser chrome. Source contains populated restaurant data; implementation contains the actual shop's empty catalog. Compared both images together through view_image; state mismatch is intentional and no live fixture products were inserted.

## Findings and comparison history

- Initial capture: existing 80px header reduced available product space. Fixed to 52px compact header, 64px white rail, 16px content inset and 290px right cart; final paired capture confirms the two-panel composition and compact rhythm. Source header is approximately 40px; 52px is retained for accessible controls and existing account identity.
- Typography: kept the existing Thai-compatible font stack and POS Minimal branding; 11–12px catalog/category text and 22px total follow the source hierarchy. Different brand/name/sidebar labels are intentional product constraints.
- Spacing/layout: single search row, horizontal category pills, compact image cards, right cart and mobile stacking are implemented. Final desktop capture confirms alignment and rounded white cart; mobile capture confirms search/cart remain visible without horizontal page overflow.
- Colors: source red category/order selection, green payment control, white surfaces and pale cool background reproduced using scoped POS styles. Other screens retain their approved theme. Disabled payment is muted by design.
- Images: source food photographs belong to reference restaurant products, absent from the real shop. User requires placehold.co for missing product images; this overrides the skill's generated-asset preference. Product cards use those permitted placeholders until actual images are available. No restaurant data/assets were fabricated as live inventory.
- Copy/content: retained shop identity and actual category names. Reference customer/note input omitted because collection and protection of customer data is not implemented. Payment shows the pending state explicitly.

Focused inspection: cart panel/search/category controls are legible in the full 1280×607 capture; 390×844 mobile capture provides the detailed control/spacing check. No extra crops needed for the verified empty-catalog state. Filled product-image/counter comparison remains a test gap until actual shop products exist; this report does not claim pixel-identical populated-state fidelity.

## Interactions and checks

Browser: category selection updates the live catalog while retaining the workspace; takeaway/Delivery toggles selection; disabled payment and empty cart are visible. Four automated cart tests cover quantity limits/removal and exact totals. Typecheck and build pass. Browser error-log inspection returned no entries; no claim of exhaustive console instrumentation. Persisted nonempty hosted-cart and food imagery UAT remain pending.

## Implementation checklist

- Complete: scoped desktop/mobile layout, category filtering, product grid, draft cart and storage, safe estimated totals, disabled unimplemented payment.
- Follow-up: real product images; actual populated-cart user test; server quote/checkout and stock revalidation.

No actionable P0/P1/P2 layout findings remain within the implemented scope. Intentional product/data differences above are retained.

final result: passed

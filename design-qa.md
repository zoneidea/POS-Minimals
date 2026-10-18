# KidTang selected brand QA — 2026-10-17

final result: passed

## Visual targets
- Landing: third displayed concept, /Users/zone-idea/.codex/generated_images/01a129eb-31bc-7703-a57c-6b641f1308d5/exec-0cc25578-4e29-4fc0-b924-df2504363afc.png.
- Workspace: embedded POS region of second displayed concept, /Users/zone-idea/.codex/generated_images/01a129eb-31bc-7703-a57c-6b641f1308d5/exec-e7fca317-5c29-498f-ba77-b2ae6f031a4f.png.
- User explicitly selected landing 3 / system 2. White workspace/sidebar is intentional; the third concept's dark sidebar is not the selected workspace target.

## Captures and normalization
Browser: Codex in-app browser (CUA). Source concepts: 1254×1254 pixels, desktop design intent 1440 wide. Main final desktop capture: 1280×720 CSS/physical pixels, density 1. Initial visible-window capture was 1118×922; it is not the final desktop geometry. Mobile: actual landing rendered within a 390×844 iframe; surrounding browser whitespace is QA framing, not app overflow. Desktop screenshot only covers the first viewport; lower-page DOM/AX state and sample screens were inspected separately.

- Landing: /tmp/kidtang-selected-landing.png
- System sample UI: /tmp/kidtang-selected-system.png
- Mobile: /tmp/kidtang-selected-mobile-final.png
- Dark mode: /tmp/kidtang-selected-dark-final.png
- Same-input reference/implementation boards: /tmp/kidtang-selected-landing-comparison.png and /tmp/kidtang-selected-system-comparison.png.

Comparison boards display source and implementation side by side at equal column width, maintaining intrinsic image ratios. For workspace comparison only the lower embedded POS region of the source is applicable. Different sample data and viewport density are not treated as a requirement to change existing business layout. Focused inspection covered wordmark/subtitle/rays, hero heading, sign-in fields, standard primary controls, icon/sidebar labels, product prices and cart total.

## Iteration history
1. [P2] Hero typography was too small and vertically low. Fixed by matching selector specificity, increasing desktop headline scale/weight and top-aligning the hero grid. Mobile restores the existing 35px heading at its breakpoint.
2. [P2] Public sample captures still showed the prior cart logo. Recaptured sales/inventory/report screens with the shared new BrandLogo and switched public image URLs. Social preview was also recaptured at 1200×630.
3. Post-fix comparison shows the new blue/navy wordmark and lime rays, photographic light hero, blue CTA with lime arrow treatment, white/navy workspace and blue selection/Checkout. No actionable P0/P1/P2 differences remain within the requested branding scope.

## Required fidelity surfaces
- Fonts: existing Prompt family retained; hero 800 weight, readable body and ordinary field sizes; mobile wrapping checked.
- Spacing: existing workspace/cart/pagination geometry retained; landing copy and login remain separate columns on desktop and stack on mobile. The production form's real fields determine height rather than forcing the mock's raster proportions.
- Colors: navy #071c45, primary #0067ed, pale-blue surfaces, lime #b6ee00 for landing highlights. Red destructive and green stock semantics retained. Dark mode maintains readable foregrounds.
- Images: generated standalone shop background and extracted new wordmark/favicon assets, copied into public. Hero WebP is about 40KB. No screenshot is used as an interactive UI. Product sample images are isolated fixture data; production image bindings unchanged.
- Copy: existing Thai functional text, fee 1.50%, withdrawal rate 15 baht and unavailable-withdrawal notice retained. Fee summary is below product showcase as in selected landing. No unsupported withdrawal or new payment behavior added.

## Interaction and technical checks
- IAB page identity, meaningful AX content, screenshot and console checks passed; no relevant warning/error logs.
- Dark/light toggles and create-store/login form switching passed without submitting registration or live transactions.
- Mobile layout and required labels inspected; core controls remain visible or reachable through ordinary page scrolling.
- Typecheck, landing SSR tests and production build passed. Hosted authentication, live sales and thermal printing were not repeated for this visual-only change.

## P3 / accepted differences
- Decorative rays outside the logo are omitted; logo rays and lime underline/CTA establish the selected identity. The underline spans the emphasized phrase rather than only its first word.
- Existing production container widths, data density, icon labels and functional form controls remain. The third concept's sidebar style is intentionally overridden by the user's explicit system-2 selection.
- Fee notice includes the existing disclosure for the not-yet-open withdrawal feature.


# Financial overview QA — 2026-10-18

Source visual truth: /tmp/codex-remote-attachments/01a129eb-31bc-7703-a57c-6b641f1308d5/3E755AB1-92EC-40B9-9C9C-5B94C4901122/1-Photo-1.jpg (1280×1170 pixels).
Implementation: /tmp/kidtang-financial-row.png (1280×720 pixels/CSS viewport, density 1).
Same-input comparison: /tmp/kidtang-financial-comparison.png. Both original and rendered view were opened together; their aspect ratios are preserved in the comparison board. The source is a portrait component reference; the implementation is a desktop workspace, deliberately rearranged per the user's latest instruction to one row. Operating expenses and operating profit are explicitly excluded by the user. No invented expense data.

## Comparison history

- Initial P2: global header padding added excess whitespace around the component heading. Reset padding on the scoped heading; revised capture /tmp/kidtang-financial-desktop-final.png confirms correction.
- Initial mobile P2: two narrow columns wrapped monetary values awkwardly (/tmp/kidtang-financial-mobile.png). Latest user instruction requests all cards on one row. Fixed to three min-width cards with internal horizontal scrolling; revised /tmp/kidtang-financial-mobile-row.png retains complete monetary values.
- Final same-input source/implementation review: /tmp/kidtang-financial-comparison.png. Three full monetary cards are readable in one row, with green gross profit and 40% margin matching the supplied example. The change from portrait 2×2/total to a three-card row and omission of expenses are requested changes, not fidelity defects.

## Required fidelity surfaces

- Typography: existing Prompt, hierarchy from section title to muted labels and large tabular amounts. THB values retain two decimals.
- Layout: existing KidTang border/radius/spacing, equal card widths, single row; mobile 390×844 iframe scrolls the summary internally. Surrounding browser whitespace in mobile screenshots is outside the app.
- Colors: blue/navy/light surfaces from existing tokens; green profit and red loss; dark green/red variants retain contrast. Dark screenshot /tmp/kidtang-financial-dark.png verifies palette (captured before the final single-row layout; final layout changes no theme tokens).
- Assets: reference contains no raster imagery; existing Lucide financial icons are used, with existing brand assets untouched.
- Content: real filtered data only, excluding VAT/voids; historical COGS, signed gross profit and null-safe percentage. No expense UI or claim of net operating profit.

## Interaction and data checks

- Browser: current day, month preset and selected report grouping; summary values from the actual report API/RPC on isolated PGlite, with 150000/90000/60000/40.00% fixture.
- Light/dark toggle and responsive sidebar preserved. Browser console warn/error list empty.
- Custom date entry automation did not retain synthetic changes on submit, so custom-date browser UAT is not claimed. Existing ReportFilters was unchanged; SQL date/cashier bounds are covered by regression tests.
- New database regression proves snapshots, VAT, negative/zero revenue, void exclusion, cashier and Thai-midnight filters, all-range pagination invariance, tenant isolation and permissions. No live sale/stock records were created.
- Existing full-suite run hit local timeouts in three pre-existing DB tests. All remaining tests passed; rerunning those three alone with one worker passed unchanged.

No actionable P0/P1/P2 findings remain in the requested overview. Focused card details are readable in the desktop capture; no extra focused crop is needed.

final result: passed

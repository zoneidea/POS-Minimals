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

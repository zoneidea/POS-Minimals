# Reference theme QA

Source: /Users/zone-idea/Documents/reactworkspace/pos/docs/design/pos-desktop-concept.png
Implementation: /tmp/pos-theme-desktop-1.png (isolated fixture preview)
Viewport: 1568×1003 CSS pixels; source 1568×1003 and implementation 1568×1003; density 1, no resampling. Full-view source and implementation opened together for comparison. State: light POS with three selected products (first quantity two).

Scope: theme application to the existing production web app, not copying sample product data or adding source-only functionality. Retain POS Minimal brand, permission-scoped menus, square product cards, repeated product clicks, red remove, Checkout Modal and existing payment availability. These are intentional differences from the reference. The reference's product photos and avatar are not stock data; actual image URL bindings and current user identity stay intact. Fixture images use placehold.co as required by repository instructions and do not replace production images.

## Iteration 1 — blocked
- [P2] Typography: sidebar/product labels are visibly too small relative to reference. Increase desktop menu labels to 15px, product names/prices to 16px, stock to 13px; header account to 16px. Evidence: source/readable 16–18px labels versus implementation 11–13px.
- Spacing/layout: white sidebar with blue active row, thin borders, contained product imagery and separated cart are present. Square grid and compact checkout panel intentionally retained instead of tall cards and inline payment controls.
- Colors: blue primary, white surfaces, navy foreground and green stock map to reference; no synthetic online/payment states.
- Images/icons: keep real source bindings and lucide icons; fixture placeholders are QA data. Category fallback Tags icon is appropriate when category data has no icon field.
- Copy: existing Thai labels retained; no new unsupported menu entries or payment choices.

Focused inspection: header/navigation, product card text/add affordance, cart rows and checkout action checked from same viewport screenshot and DOM. Functional proof so far: repeated catalog click updates cart to ×2; three products total ฿123.00.

## Iteration 2 — passed
- Desktop typography refined to readable menu/product labels. Final comparison: source and `/tmp/pos-theme-desktop-final.png`, 1568×1003, light POS. White surfaces, blue active navigation/price/checkout, navy labels, green stock and thin borders match the requested direction.
- Mobile regression fixed: equally specific mobile navigation rules stack every icon/label, including formerly overridden nth-child/dark selectors. Grid rows now use max-content to retain square cards in a bounded scrolling catalog. At 390×844: cards 136×136, second row starts 150px below first; document scrollWidth equals viewport 390px. Evidence: `/tmp/pos-theme-mobile-final.png`.
- Dark POS checked; stock color brightened for legibility. Reduced-motion preference retained.
- Rendered screens reviewed: POS Grid/List, Dashboard charts, categories, inventory table/edit Modal, settings inline form/receipt preview, staff, sales/bill Modal and stock audit error shell. Existing Thai copy, real image bindings and feature controls remain.
- Fixture UUID validation corrected outside the repository. Cart ×2/฿24 survives reload and menu navigation. Checkout opens; +50 yields ฿26 change. No sale, member or settings mutations submitted.
- Automated verification: 44 test files / 269 tests passed, typecheck passed; final production build passed after responsive CSS refinement. Existing bundle-size advisory remains.
- Theme QA uses isolated API fixtures, not an authenticated production business-flow UAT. Hosted authentication screen and release health checks verified separately at deployment.

final result: passed

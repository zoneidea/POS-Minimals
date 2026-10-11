# Modern UI system — 2026-10-12

Concept: [modern-pos-concept.png](design/modern-pos-concept.png), generated with the built-in Image Gen tool as a complete inventory screen plus Modal/mobile references. Brief: modern futuristic Thai POS Minimal, ink icon sidebar, cool neutral surfaces, violet/cyan accents, ordinary flat controls, ten-row tables and stock adjustment/history; preserve existing information architecture and avoid fake metrics/product imagery.

## Design system

Shared styles now replace Neumorphism: background #f4f6fb, white surfaces, ink rail #101b29, primary #5938ed, selected cyan #56e5ef, thin borders and deliberate small control typography. Dark mode has equivalent dark surfaces and accessible focus rings. AppHeader owns the common brand, real store/account identity and theme toggle. Sidebar remains icons only with accessible labels/tooltips. Authentication, recovery, onboarding, account, categories, inventory, notices, Modal and pending-module surfaces inherit this system. Business modules that were pending remain pending.

## Fidelity ledger and verification

IAB screenshot inspection with view_image compared concept and actual renders at 1440x1000 desktop and 390x844 mobile, plus a final 1504x1046 capture matching the generated concept dimensions. No alternate browser or Playwright fallback was used. Inspected these concrete points:

| Point | Concept vs implementation | Resolution |
|---|---|---|
| Palette | Cool background, white table, ink rail, violet CTA and cyan selection | Shared CSS tokens and Tailwind control overrides match the chosen palette |
| Layout | Table-focused workspace with left rail and top header | Preserved continuous app shell; icon-only 84px rail (68px mobile) follows prior user instruction |
| Typography | Strong Thai headings and compact readable table/control text | Explicit heading/control/cell sizing; native text remains selectable |
| Controls | Flat inputs/buttons and Modal focus/busy states | No raised/inset controls; fixed initial Modal autofocus and retained Escape/cancel behavior |
| Tables | Ten rows and visible pagination/empty state | Empty content now uses container width instead of disappearing in the horizontally scrolling table; compact mobile pagination stays in one row |
| Responsive | Mobile table scroll and readable forms | Verified 390px view, mobile history Modal and shared account/category surfaces |

Intentional differences from generated reference: icon-only rail rather than generated text menu, existing exact table/CTA copy, no unimplemented search/filter/page-size selector or fabricated example product, and global stock-history action added for the user's requested retained logs. Lucide code-native glyphs preserve existing icon vocabulary; no branded raster asset is used as executable UI. Above-the-fold copy follows the existing app plus explicitly requested stock-history workflow; generated marketing subtitles and controls were omitted.

Browser path checked: actual owner's empty inventory → open/cancel product Modal → open/close hosted stock history, plus category/mobile, light/dark and forgot-password form checks. No products/stock changes were made in the user's store. Stock mutation invariants are covered by SQL/HTTP tests; actual owner adjustment UAT remains. The implemented design direction was visually compared to the concept with the intentional differences above; no claim of pixel-identical reproduction is made.

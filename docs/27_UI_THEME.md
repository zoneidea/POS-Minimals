# Color and depth refresh — 2026-10-12

Shared theme tokens in apps/web/src/theme.css apply ice blue/lavender background, white rounded surfaces, teal primary gradients, inset highlights and layered shadows. Dark mode uses navy surfaces with readable pale text. Existing labels, routes, controls and business behavior are preserved.

Reference: /Users/zone-idea/.codex/generated_images/01a129eb-31bc-7703-a57c-6b641f1308d5/exec-0c036bf8-ccd4-479f-b3a3-e2ea5b8b665a.png. Browser JPEG: same directory, pos-restyle-desktop.jpg. QA images remain outside the repository.

IAB used for desktop/native viewport and 390x844 mobile inspection, open/cancel category form, dark/light toggle and horizontal-overflow check (390px client and scroll width). Build passes. No new tests for this CSS-only change. Concept and browser screenshot inspected using view_image.

Comparison ledger: (1) blue/lavender canvas; (2) elevated white header; (3) pastel sidebar with raised teal active state; (4) rounded white category panel; (5) gradient primary button/highlight; (6) unchanged Thai heading and empty-state copy. Preserved Lucide metaphors rather than generated illustrative substitutes. Toolbar account link has no dropdown because it remains a link. These are deliberate functional-preservation differences. Existing icons and native Thai typography retained. The visual direction was verified against the generated reference; responsive dimensions adapt to actual viewport.

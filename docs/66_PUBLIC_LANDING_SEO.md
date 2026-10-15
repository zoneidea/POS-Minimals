# Public landing page and SEO delivery

## Delivered scope
1. Public `/`: product navigation, hero plus existing login form, same-page sign-up,
   actual-app sample screenshots, PromptPay explanation, pricing, getting-started
   steps and six keyboard-operable native FAQ disclosures.
2. Existing Supabase email sign-in, verification, password recovery and role-based
   workspace routing are retained. Shared login fields keep static and interactive
   markup aligned. No API or database changes are included.
3. Free software usage is distinguished from the supplied 1.50% payment fee and
   future THB 15 withdrawal fee. The user approved explicitly marking withdrawal
   requests unavailable. Uploaded static QR still requires manual confirmation;
   automated verification requires configured receiving-bank details and checking
   the payment result. No settlement time/minimum/tax claim is added.
4. Public screenshots are captured from actual UI components with isolated sample
   data, not live business accounts. They show sample sales, inventory and reports.
   No actual store names, contact details, credentials or financial records appear.
   WebP 1600×1000 originals and 800×500 variants support responsive lazy loading,
   declared dimensions and opening the readable full-size original. Share artwork
   is a 1200×630 browser-rendered composition of the actual sample POS screenshot.

## Approved build change
The user approved static prerendering on 2026-10-15. `vite build` is followed by
`scripts/prerender-web.ts`, using the existing Vite/React stack. It renders the same
LandingPage components into `dist/index.html`; React hydrates that markup. Auth
fields are disabled only while the existing session initialization runs. Static
content and native FAQ remain readable without JavaScript; sign-in needs JavaScript.

Build output includes route-specific `internal/*.html` files for workspace,
forgot/reset-password and invitation routes, with an empty application root,
`noindex, nofollow` and their own canonical URL. Vercel dispatches API requests
first, serves existing static files, then maps known private routes to their
internal HTML and unknown routes to a noindex fallback. Private routes also get
`X-Robots-Tag`; these directives never replace authentication or tenant checks.
Client navigation updates canonical/robots/social metadata and removes public
structured data on private pages. No change to single-deployment topology.

The home document includes the specified Thai title/description, lang/UTF-8,
viewport, canonical, Open Graph and Twitter large-image metadata. JSON-LD WebSite
and SoftwareApplication describe the free software offer and separate fees;
there are no fabricated ratings, reviews, awards or usage counts. Thai body and
headline fonts are preloaded. No meta keywords are added.

Public endpoints after deployment:
- `/sitemap.xml`: only the public home page.
- `/robots.txt`: references the sitemap, without hiding private pages from noindex
  discovery or weakening their authentication.
- `/images/pos-minimal-share.webp`: public 1200×630 share image, no login required.

## Google Search Console handoff
Status: **Pending owner verification code**, as confirmed by the user.
1. Owner adds the URL-prefix property `https://pos-minimals.vercel.app/` in Search
   Console and selects HTML-tag verification.
2. Supply only the `content` value of the verification tag. Put it in Vercel build
   environment variable `GOOGLE_SITE_VERIFICATION`, then rebuild/deploy. The build
   emits that meta tag on the home page only. No placeholder verification is shipped.
3. Owner verifies the property, submits
   `https://pos-minimals.vercel.app/sitemap.xml`, and uses URL Inspection to request
   indexing. Keep the verification value configured for subsequent builds.
4. Search-engine indexing and rankings are not guaranteed by this implementation.

## Validation and design fidelity
Browser/IAB is used for desktop 1435×1096 (native hero-concept dimensions), tablet
768×1024, mobile 390×844 and dark-mode checks. The concept and final captures
were both inspected with view_image; no material unresolved layout mismatches
remain. Copy comparison retains the supplied hero/fee text, with the approved
unavailable-withdrawal qualification and actual-service context. The actual
app, backed by isolated auth fixtures, verifies employee → `/pos`, owner →
`/dashboard`, accountant → `/reports`, sign-up → verification notice and forgot
password → request-sent notice. These are interaction regressions with mocked
services, not evidence of sending actual emails or creating live accounts.

Compared against the generated visual references:
- Header/hero: shared white/cobalt/navy palette, Prompt type, left offer and right
  login form; fixed-header padding inherited from the workspace was removed.
- Above-fold copy: supplied H1, benefit copy and fee amounts retained; the approved
  unavailable-withdrawal note is explicit. Existing hexagon brand is preserved.
- Product tour: large POS view followed by alternating product/report screenshots;
  actual app imagery replaces concept mockups and can open at full resolution.
- Payment/pricing/FAQ: open explanatory layout, separate ruled pricing table,
  three-step start flow and native disclosures; no invented withdrawal screen.
- Responsive: desktop two-column login, stacked mobile layout, quick login anchor,
  no horizontal page overflow and image dimensions reserved to prevent shifts.
- Shared compact fixed powered-by footer is retained from the existing system.

Lighthouse mobile on compressed local production artifacts: Performance 91,
Accessibility 100, Best Practices 100, SEO 100; LCP 2.9 s, CLS 0.002. Results are
lab measurements and vary by device, network and deployment. Each responsive
screenshot is approximately 14–56 KB. Reports and QA scripts stay outside Git.

Build/typecheck, render/route tests, complete baseline regression and production
HTTP/browser smoke checks are release gates. Real account/email UAT can be repeated
by the owner after deployment. Search Console setup and withdrawal development
remain separate outstanding work; neither is presented as complete.

Rollback: revert this frontend/build/routing change and redeploy together. No
database rollback or financial-data mutation is involved.

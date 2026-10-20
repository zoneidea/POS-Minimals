# POSJung display branding — 2026-10-20

The current product name is **POSJung**, with the supplied “ขายง่าย ใช้ฟรี” wordmark and separate J/check/lime-dot icon. This supersedes the historical KidTang directions below.

- Shared responsive BrandLogo covers Web, Landing, verification and LINE MINI App. New optimized wordmark and square PNG icon are served from `public/brand/posjung-*`; favicon, Apple icon and legacy favicon SVG use the supplied emblem.
- Titles, descriptions, application-name, Open Graph/Twitter and WebSite/SoftwareApplication JSON-LD use POSJung, including initial prerendered HTML. Social image is 1200×630 at a fresh URL. Landing product screenshots use the current shared UI with isolated sample data, without real shop writes.
- Source email templates, XLSX display headings, printer test/error messages and Print Agent source window/tray/icon use the new name. Hosted Supabase email templates require publication in Auth settings. Already-installed/downloadable native Agent binaries retain their installed branding until a separate installer release; pairing protocol, executable identifiers and download filenames stay compatible.
- Keep `https://pos-minimals.vercel.app`, canonical/Sitemap routes, Google verification, LIFF configuration, Auth redirects, package IDs, existing storage/cache/pairing namespaces and historical receipt/shop snapshots unchanged. No API contract, database or business logic change; only exported document display headings change.
- Company footer stays **POWERED BY ZONE-IDEA INNOVATION CO.,LTD.** LINE Developers channel name/icon are external Console settings and are not changed by deploying this source.
- User-reported same-browser LINE → Web SSO acceptance is **Pass**; this change does not modify SSO logic.

Validation: focused tests **30 passed**, complete regression **96 files / 462 tests passed** in an isolated Git snapshot preserving pre-existing local test deletions. Full local run used one worker and 120-second test/hook limits after the first concurrent run timed out during PGlite initialization; no application logic was changed for the timeout. TypeScript and production build passed; generated public/private/LINE HTML and image dimensions verified. Print Agent checks: 11 passed, 2 platform-specific skips. Browser fixture checks cover desktop/mobile and light/dark.

## Historical directions (superseded)

# KidTang display name and search metadata

The product display name is **KidTang** (user request, 2026-10-16).

- Shared workspace and public landing headers, public footer, verification and
  recovery text, sample-image alt text, test receipt, Excel report/template
  headings and API documentation use KidTang.
- Prerendered HTML and runtime navigation metadata use KidTang in title,
  description, application-name, Open Graph site name/title/description and
  Twitter metadata. WebSite and SoftwareApplication structured data use KidTang.
- New sample captures use real shared UI components with isolated sample data.
  Three 1600×1000 WebP screens have 800×500 variants. The share image is 1200×630.
  New kidtang-* URLs prevent reusing cached old artwork; existing image URLs
  remain available with the new artwork for incoming links.
- Supabase email template source files and the companion app's source window/tray
  text use KidTang. Hosted email templates require publication in Supabase Auth;
  already-installed native companions require a later installer release.
- Keep deployment domain https://pos-minimals.vercel.app, canonical URLs, Google
  verification file, sitemap, Auth redirects, package IDs, printer bridge protocol,
  persistence/cache namespaces and historical financial snapshots unchanged.
- Company attribution remains POWERED BY ZONE-IDEA INNOVATION CO.,LTD.

Validation: TypeScript/build, generated HTML metadata and image dimensions,
existing email-template test updated to the new brand, full regression suite and
browser checks for public/authenticated pages. No shop or payment data is modified.

## Supplied logo — 2026-10-17
The user-provided blue cart/baht logo now replaces the generic hexagon in the
shared application header, public landing header/footer and signup verification
panel. BrandLogo shares one responsive asset across these surfaces. The original
JPEG is stored unchanged in public/brand/kidtang-source.jpg; self-contained SVG
viewports frame the original emblem and wordmark horizontally without redrawing
or recoloring their pixels. A white plate preserves wordmark contrast in dark mode.
The supplied emblem replaces the browser favicon (including the legacy SVG URL).
Structured data includes the brand logo. Domain/canonical/Auth settings are unchanged.

Public product screenshots were recaptured with the shared AppHeader and isolated
sample data, and the social image includes the supplied logo. New image URLs avoid
cached old artwork; original image URLs remain available. No database, business
logic, authorization, receipt layout or native installer changes.

Validation: typecheck/build and browser checks for desktop/mobile, light/dark,
image loading, meaningful content and theme switching. Browser plugin unavailable;
Playwright used an existing Chrome for Testing binary, no new dependency installed.
Authenticated header uses the shared component tested in sample screens; no live
sales or account mutations were created during visual QA.

## Approved split visual direction — 2026-10-17
User selected landing concept 3 and workspace concept 2 from the displayed image
set. Shared logo is now the blue/navy KidTang wordmark, “คิดตังค์ by ZoneIdea”
subtitle and lime rays from the supplied campaign; favicon is a blue K with lime
rays. BrandLogo uses public/brand/kidtang-wordmark.webp. New PNG favicon and Apple
touch icon use public/brand/kidtang-k-icon.png; legacy SVG URLs wrap real artwork.

Landing has a standalone optimized shop-photo background, enlarged navy/blue
headline, lime emphasis/CTA arrow and pale-blue product showcase. Fee summary is
below the POS showcase and retains withdrawal-unavailable disclosure. New sample
and social URLs avoid stale prior branding. Workspace keeps its existing white
sidebar, icon labels underneath, ordinary blue controls, compact cart and current
behavior. Shared theme tokens and alerts use the approved blue/navy palette.

No database/API/auth, sale, stock, payment, print-agent or receipt changes.
See root design-qa.md for source images, comparison history and browser evidence.

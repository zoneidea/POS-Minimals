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

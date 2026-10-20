# posjung-agent

The user approved a local Agent for Windows and macOS, with installer downloads in store settings. The existing web/API/Supabase deployment stays together; the optional Electron companion runs on each physical POS computer.

## User path

Store settings → printer settings provides Windows x64, macOS Intel and macOS Apple Silicon installer links. Install the OS printer driver first, open Agent, enter its six-digit pairing code in POS, select system default or a named printer and 58/80mm, save and test. Preferences are local to that browser, shared across signed-in users on that physical browser. Agent may start on OS login if enabled in its window. Reset in Agent revokes all paired browser tokens; disconnect in the website removes only that browser's saved profile.

Receipt printing after sale and copy printing from bill Modal both use Agent when configured. Agent failure displays a message without falling back to a browser dialog or changing a completed sale. Without a saved Agent profile the original browser-print route remains available. After confirmed cash/Gateway sale completion, POS now submits the original receipt automatically, closes Checkout and releases the cart for the next sale. Print errors do not undo sales or retry payment/printing; staff can deliberately print a copy from Sales. Browser may require permission to access local devices; no kiosk flag or disabled browser security is required. Physical printer/driver UAT remains necessary.

## Local protocol

Agent binds only `127.0.0.1:17865`, accepts exact production Origin `https://pos-minimals.vercel.app`, and checks the Host. Development builds also allow local port5173. JSON POSTs are limited to1MiB; CORS/PNA headers are explicit, with no wildcard origins. Desktop receipt windows disable page JavaScript/Node integration, use sandbox/context isolation and an isolated session, deny external resources/navigation and do not persist receipt content.

- `GET /health`: version only, no printer names.
- `POST /pair` with `{code}`: returns a random 256-bit token; five incorrect attempts cause a60-second lock. Pairing replaces that origin's previous token.
- `GET /printers` with `Authorization: Bearer token`: returns `{printers:[{name,displayName,isDefault}]}`.
- `POST /print` with the bearer token and `{jobId,html,width:58|80,printer:""|systemName}`: empty name selects OS default; configured printer must exist. Returns `{submitted:true}` after native queue submission. This does not prove paper output. Repeated job IDs in the current Agent session return409; no automatic retries. After network failure users must check the printer before deliberately reprinting.

Agent stores token hashes, not tokens or receipt content, in OS user-data. Browser stores its limited print token locally. Local Agent logs contain timestamp/event/job UUID and allowlisted failure codes only; expired dated log files are removed at30 days during logging. All financial audit/tenant authorization stays in the existing API.

## Packaging/distribution

`apps/print-agent` uses Electron44.7.2 pinned exactly. `npm run test -w @pos/print-agent` verifies Origin/auth/pairing/default printer selection/replay guard/revocation with a mock native printer. Local macOS builds with restricted caches use:

```bash
ELECTRON_BUILDER_CACHE=/tmp/pos-agent-builder-cache npm run package:mac -w @pos/print-agent -- --x64 --config.electronDownload.cache=/tmp/pos-agent-electron-cache
```

Tag `print-agent-v1.0.2` triggers the native Windows/macOS GitHub Actions matrix. After all builds pass, release assets and SHA256 checksums are published in the existing public repository; the web links point to these versioned files. Agent packaging includes only its own source/assets/package metadata, excluding tests; database credentials and root environment files are not bundled. Installers in this initial test release are not developer-signed/notarized, so OS verification warnings may appear. Signing requires developer certificates as a separate release setup.

Verification so far: Node bridge tests, web typecheck and production build passed. Browser fixture paired with a mock native Agent, saved default/58mm and submitted a test job successfully. Existing tests were already locally removed before this work; those deletions are not part of the Agent commit. Installer artifacts/download checks and real hardware UAT are separate from mock queue-submission proof.

## PrinterInfo compatibility fix — 1.0.2
Electron's current PrinterInfo can omit `isDefault`. The web client accepts an
omitted flag as false (without guessing the first printer) for compatibility
with installed 1.0.1 Agents. Invalid strings/null and missing printer names still
fail validation. The Agent normalizes its printer-list response to boolean flags
and a usable display name, exposing no platform-specific printer options.

Empty `printer` continues to mean OS default. The bridge checks that at least one
printer exists, then lets Electron resolve the OS default through empty deviceName;
it no longer rejects the request merely because no default flag was reported.
Named devices still must exist. Origin, token and duplicate-job protections remain.
Reference: https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions-callback

For installed 1.0.1: refreshed web pairing/enumeration works; select a named printer
until upgrading to 1.0.2 if using the old bridge's default-printer option fails.
New 1.0.2 installers retain app identity and pairing storage. Publishing is handled
by the existing Windows x64 / macOS Intel / macOS Apple Silicon release workflow.
Regression tests cover the exact five-device omitted-field response, explicit flags,
malformed data, unnamed devices, OS-default forwarding, named selection, no printers,
and existing origin/authentication/replay protection. Native tests use mock queues;
physical printer and installed-OS UAT remains necessary.

Release `print-agent-v1.0.2` is published with Windows x64, macOS Intel and macOS
Apple Silicon installers plus SHA256SUMS.txt. Store-setting download links now
point to those verified non-empty release assets. Browser compatibility hotfix
was deployed before the installer-link update. Platform checks and the three-OS
installer workflow passed. Physical printing still requires user UAT.

## Receipt rendering fix — 1.0.3
Reproduced on actual Electron 44.7.2: receipt windows disable JavaScript, so the
old page-world executeJavaScript call rejects before reaching the native print
API. Measurements now use fixed trusted code in isolated world 1001. Receipt
JavaScript stays disabled, as do Node integration and external-resource access;
sandbox, context isolation, origin/token checks and replay protection remain.

The Electron smoke test reproduces the old rejection, runs the production height
helper successfully and proves an embedded receipt script did not run. It never
submits a physical print job. The installer workflow runs it on Windows x64 and
both macOS targets before packaging.

Native callback failures now retain safe codes: PRINT_INVALID_SETTINGS,
PRINT_CANCELED, PRINT_FAILED; layout errors use RECEIPT_LAYOUT_FAILED. Missing
printers return PRINTER_UNAVAILABLE. Authenticated native-error responses include
`{error,code,jobId}`; unknown driver text, HTML, names and tokens are excluded from
responses/logs. Web warnings interpret codes and recognize legacy missing-printer
responses. No automatic retry/fallback is added. Agent shows its installed version.
Physical printing on the user's Windows printer remains UAT after installation.

Release `print-agent-v1.0.3` is published with verified non-empty Windows x64,
macOS Intel and macOS Apple Silicon assets and a three-entry SHA256 manifest.
Store-setting links now point to 1.0.3. All three installer jobs passed the actual
Electron regression/safety smoke test. Local verification: 419 Vitest cases, five
native Node tests, Electron smoke, typecheck and production build passed.
Platform checks passed for the source branch and release tag.

## Content-sized receipts and automatic checkout printing — 1.0.4
The user confirmed 1.0.3 can print, then reported excess blank paper and truncated
receipt content. New receipt HTML uses a paper-width variable (58/80mm), compact
headings, fixed product/quantity/net columns, and explicit totals/change. The Agent
uses the selected paper width for its renderer, waits for embedded fonts and images,
and measures actual body/child bounds instead of viewport-dependent root scrollHeight.
A short receipt no longer inherits a 600px minimum window; the bottom safety margin
is 8px. The native page includes the receipt footer. No API/DB/RBAC changes.

Checkout invokes print only after a confirmed committed or recovered sale; it no
longer waits for the success alert or opens SaleReceipt. The matching cart clears
and Checkout closes before waiting for the print queue. Gateway recovery of an
older/different cart preserves the current cart. Each completion is guarded by sale
ID for that POS mount. No automatic print retry is performed; inline print warnings
direct users to Sales for a deliberate copy. Stored idempotency recovery is retained.

Without a paired Agent the existing browser print dialog still applies; a browser
cannot silently print by itself. Silent printing requires the installed Agent.
Real printer/driver layout and cash/Gateway checkout UAT remain required after rollout.

Release `print-agent-v1.0.4` is published; Windows x64 / macOS Intel / Apple Silicon
assets are non-empty and the SHA256 manifest has all three entries. All installer
jobs and branch/tag Platform checks passed. Local DB tests hit initialization
timeouts; the complete suite passed on GitHub CI. Focused tests, typecheck and build
passed locally. Browser fixtures at 58/80mm showed no horizontal overflow and full
totals/change. Actual Electron PDF checks with embedded Prompt fonts produced one
page each for short 58/80mm and a 12-item long receipt, with footer inside page.
Screenshots/PDFs are local QA artifacts outside the repository. Physical printer
margin/feed/cut behavior remains user UAT; refresh web and install 1.0.4.

## Windows driver printable area — 1.0.5
User UAT on Gprinter GP-C80250I Plus, 80mm, Agent 1.0.4 still clipped the right
edge and receipt footer after Windows paper length was changed to 210mm.
Confirmed mismatch: manufacturer maximum print width is 72mm, while 1.0.4 used
80mm body width and independent calculated media height. PDF checks do not prove
Windows driver media/margins.

For Windows, a fixed read-only PowerShell/System.Drawing query reads the selected
printer's portrait default paper size and PrintableArea (hundredths of inches,
converted to mm). Printer names travel as base64 environment data, never shell
interpolation. It changes no OS/driver setting, prints nothing, needs no admin,
uses no execution-policy override and has a 15s timeout. Invalid metrics fail safely
instead of silently assuming A4. Paper width must match POS within 2mm.

Native media dimensions now use the measured driver paper (including its 210mm
length), with printableArea margins and scale 100. This deliberately avoids
Electron's usePrinterDefaultPageSize fallback to A4 for drivers that cannot expose
semantic defaults. Rendering fits min(roll minus 8mm, measured printable width minus
0.5mm), including all receipt padding. Long bills paginate on the driver's paper
rather than being truncated; cutter-per-page behavior remains hardware UAT. macOS
retains measured content height with a conservative roll-minus-8mm content width.

Agent shows safe numeric paper/printable/content dimensions for the last job and
logs those numeric dimensions with its job UUID for 30 days. Printer names, receipt
HTML, tokens and driver exception text are excluded. New safe error codes:
PRINTER_METRICS_UNAVAILABLE and PRINTER_PAPER_MISMATCH; old clients still receive
the existing failure envelope. No sale/payment/DB/role or pairing changes.

Sources: https://en.gprinter.net/products_show.asp?lan=zh-en&newsid=473099627&skin=2
https://learn.microsoft.com/en-us/dotnet/api/system.drawing.printing.pagesettings.printablearea
https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions-callback
Physical Gprinter UAT is required; mock geometry, Windows query parser/API and
Electron renderer tests cannot establish actual paper output.

Release print-agent-v1.0.5 is published with non-empty Windows x64 and both macOS
installers plus a verified three-entry SHA256 manifest. Native tests and Electron
smoke passed across the three installer jobs; branch/tag Platform checks passed.
Local focused tests, typecheck and build passed. The long renderer fixture measured
436.7mm and generated three PDF pages on 210mm paper. This is pagination/geometry
proof, not a Gprinter hardware result. Store links point to 1.0.5; keep POS at 80mm
and verify the installed Agent version before reprinting an existing bill for UAT.

## Narrow logical Windows pages — 1.0.6
The 1.0.5 width guard incorrectly required driver logical page width to equal
physical roll width within 2mm. An 80mm roll can have a narrower logical page.
The guard now permits narrower pages and fits content inside both measured paper
and printable width, while retaining driver height/margins and rejecting pages
wider than the selected roll plus 2mm. No OS settings are changed. This removes
the false mismatch for 64/72mm logical pages on an 80mm selection; it does not
establish which dimensions the user's driver actually reports.

Measured numeric dimensions are logged/displayed before plan validation, including
failed jobs. An authenticated PRINTER_PAPER_MISMATCH response may now add
`details:{requestedWidthMm,paperWidthMm,paperHeightMm,printableWidthMm}`. Both bridge
and web validate bounded numbers; arbitrary fields, printer names and raw driver
errors remain excluded. Old Agent errors still work. No automatic retry, sale,
stock, payment, pairing or permission changes. Native regression tests cover
narrow logical pages, oversized A4 pages and safe diagnostics. Physical Gprinter
output remains user UAT after installing the new Agent.

Release print-agent-v1.0.6 is published with verified non-empty Windows x64 and
both macOS installers, plus a three-entry SHA256 manifest. All native installer
jobs (including Windows read-only driver tests and Electron smoke) and branch/tag
Platform checks passed. Local focused web/native tests, Electron smoke, typecheck
and build passed. Store download links now target 1.0.6. Reprint a copy of an
existing bill for physical UAT; no live sale or physical job was created in QA.

2026-10-17 user UAT: receipt paper sizing passed after Agent 1.0.6. This records
the confirmed sizing result, without claiming untested printer brands or flows.

## 1.1.0 — posjung.com and customer display

The owner authorized the formerly deferred second-screen feature. See [local display contract and acceptance](76_CUSTOMER_DISPLAY_AGENT.md). Exact posjung.com Origin is additive to the original deployment; settings can choose an extended external screen. Existing print job semantics, Windows paper layout, native application ID/productName and saved pairing hashes are retained. New customer window/frames are isolated from receipt windows and business writes. Updated native binaries must be installed and paired from the new origin before use.


## 1.1.2 — macOS tray and application name (2026-10-20)

The application, window/title, tray tooltip/menu and installer files now use `posjung-agent`. macOS uses a dedicated monochrome 18×18 Template image, with a 36×36 @2x/144dpi representation; the colored 128px application image is no longer passed to the menu bar. Template rendering follows the OS menu-bar appearance. Windows tray artwork remains unchanged. Editable SVG source is packaged alongside the generated PNGs.

Internal package `@pos/print-agent`, application ID `com.zoneidea.pos.printagent`, installer upgrade identity, Origin allowlist, local API and print/display protocols are retained. Runtime pins the existing userData path before setting the new display name, creating the directory safely on a new installation. Pairing hashes and logs remain in that same directory; no credential migration/reset is performed. Quit the old Agent before installing/opening `posjung-agent`; on macOS use the renamed application instead of retaining an active old copy. Verify automatic startup points to the installed app if it was enabled previously.

Release filenames: `posjung-agent-1.1.2-win-x64.exe`, `posjung-agent-1.1.2-mac-x64.dmg`, `posjung-agent-1.1.2-mac-arm64.dmg`; existing releases remain accessible. Web download links and visible product-name hints match the new release. No cloud API, database, RBAC, receipt or customer-display calculation changes.

Local validation: native checks 21 pass/two Windows-only skipped on macOS; receipt/customer-display/tray Electron smoke pass. Actual macOS Tray reports an 18×18 image, scale factors 1/2, and a 34×24 native click area including OS padding. Identity checks cover both Windows/macOS path forms. Web printer/display checks: 16 pass; typecheck passes. Release workflow repeats native checks and all smoke tests on Windows x64/macOS Intel/Apple Silicon.

References: [Electron Tray guidance](https://www.electronjs.org/docs/latest/api/tray#class-tray), [Template images](https://www.electronjs.org/docs/latest/api/native-image#template-image).

The unpublished 1.1.1 tag was blocked by the macOS CI runner reporting tray height zero despite correct 34px width and verified 18px Template/Retina image. Version 1.1.2 permits zero native menu-bar height only when CI=true, while still asserting image dimensions, high-density representations, template mode and bounded tray width. Real local macOS verifies positive native height. Failed tag is retained; no published tag/assets were replaced.

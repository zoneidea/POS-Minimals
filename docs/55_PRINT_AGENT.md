# POS Print Agent

The user approved a local Agent for Windows and macOS, with installer downloads in store settings. The existing web/API/Supabase deployment stays together; the optional Electron companion runs on each physical POS computer.

## User path

Store settings → printer settings provides Windows x64, macOS Intel and macOS Apple Silicon installer links. Install the OS printer driver first, open Agent, enter its six-digit pairing code in POS, select system default or a named printer and 58/80mm, save and test. Preferences are local to that browser, shared across signed-in users on that physical browser. Agent may start on OS login if enabled in its window. Reset in Agent revokes all paired browser tokens; disconnect in the website removes only that browser's saved profile.

Receipt printing after sale and copy printing from bill Modal both use Agent when configured. Agent failure displays a message without falling back to a browser dialog or changing a completed sale. Without a saved Agent profile the original browser-print route remains available. Automatic printing on sale completion is not introduced by this slice. Browser may require permission to access local devices; no kiosk flag or disabled browser security is required. Physical printer/driver UAT remains necessary.

## Local protocol

Agent binds only `127.0.0.1:17865`, accepts exact production Origin `https://pos-minimals.vercel.app`, and checks the Host. Development builds also allow local port5173. JSON POSTs are limited to1MiB; CORS/PNA headers are explicit, with no wildcard origins. Desktop receipt windows disable page JavaScript/Node integration, use sandbox/context isolation and an isolated session, deny external resources/navigation and do not persist receipt content.

- `GET /health`: version only, no printer names.
- `POST /pair` with `{code}`: returns a random 256-bit token; five incorrect attempts cause a60-second lock. Pairing replaces that origin's previous token.
- `GET /printers` with `Authorization: Bearer token`: returns `{printers:[{name,displayName,isDefault}]}`.
- `POST /print` with the bearer token and `{jobId,html,width:58|80,printer:""|systemName}`: empty name selects OS default; configured printer must exist. Returns `{submitted:true}` after native queue submission. This does not prove paper output. Repeated job IDs in the current Agent session return409; no automatic retries. After network failure users must check the printer before deliberately reprinting.

Agent stores token hashes, not tokens or receipt content, in OS user-data. Browser stores its limited print token locally. Local Agent logs contain timestamp/event/job UUID only; expired dated log files are removed at30 days during logging. All financial audit/tenant authorization stays in the existing API.

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

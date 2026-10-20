# POSJung Agent 1.1.0 — customer display and custom domain

## Scope
The owner explicitly requested support for posjung.com, local second-screen selection, the selected items, amount due/change and PromptPay QR. This extends the existing loopback Print Agent rather than introducing a cloud display or changing the sales/payment API. Windows x64, macOS Intel and Apple Silicon are distribution targets. A real extended second monitor and real printer require on-device acceptance after installation; simulated screen/renderer tests do not assert that hardware UAT.

## Configuration and lifecycle
- Exact production Origins: `https://posjung.com` and existing `https://pos-minimals.vercel.app`. No wildcard or origin supplied in the request body; existing Host check, 127.0.0.1-only bind, per-Origin pairing token and CORS/PNA protections apply to all display routes. Browser must pair again from the new origin. Old installed Agents need updating before accepting the new domain.
- Store settings adds a separate customer-display panel, using the existing locally paired Agent. Staff access/role rules for settings and POS remain unchanged. Display preferences `{enabled, displayId}` are browser/device-local (`pos:customer-display:v1`), not shop-wide database configuration. Default is disabled, making no display requests from normal POS when disabled. Printer preference format remains compatible.
- Agent enumerates real Electron screens only after app readiness. The cashier's primary monitor and mirrored/overlapping primary geometry cannot be selected. It opens a borderless customer window at the selected external screen's bounds, and closes it if the display disappears/becomes primary. Metrics changes reposition the window; no fallback onto the cashier monitor.
- POS has one ordered display session per mounted user/shop scope. Rapid cart/numpad changes are coalesced; display requests time out after three seconds and back off on failure, independently of checkout/printing. A five-second heartbeat maintains a 15-second Agent lease. Leaving POS, logout/navigation, pagehide or scope change releases the session. Interrupted unload/network loss eventually blanks item/payment content on lease expiry. The welcome window may remain open while enabled.
- Only one POS page owns the display at a time. A second live page receives DISPLAY_BUSY. Sequence numbers reject reordered frames; release tombstones reject late requests after navigation. A resumed page renews an expired session ID. Restarted Agent has no receipt/QR data and can be reconfigured from the browser's saved preference.
- Draft cart shows current catalog prices. Checkout uses the existing server quote, accepted total and discounts, with decimal-safe received/change. Pending/invalid/unaccepted totals are blank. Estimated change is labeled until an actual completed sale supplies immutable receipt totals. Completion has no QR, is displayed for eight seconds and is replaced immediately when the next cart begins.
- Uploaded PromptPay QR is the existing raster image plus current quoted amount; it does not gain payment verification or a new recording flow. Gateway QR uses the exact existing generated raster, locked amount and server-provided expiry. Hide it when the quote/amount/cart differs, expiry is unknown/elapsed, payment switches, cancellation/close happens, or the payment is terminal. Agent and renderer also enforce expiry independently. A displayed QR never means a paid sale; only the existing server-confirmed CompletedSale produces the paid view. No extra payment session or sale is created by the display.

## Local API contract (additive)
All routes except health/pair require `Origin` allowlisting, `Host: 127.0.0.1:17865` and `Authorization: Bearer <paired-device-token>`. JSON POST uses `Content-Type: application/json`, existing 1 MiB request limit and no-store responses. This is a same-machine adapter; it is not a public cloud API.

| Method/path | Request | Success response |
| --- | --- | --- |
| GET /health | none | `{version:"1.1.0",capabilities:{customerDisplay:true}}` |
| GET /displays | none | `{displays:[{id,label,width,height,primary}],enabled,displayId}` |
| POST /customer-display/configure | `{enabled:boolean,displayId:string}` | `{enabled,displayId:string|null}` |
| POST /customer-display/state | `{sessionId:UUID,sequence:positiveInteger,frame}` | `{displayed:true}` |
| POST /customer-display/release | `{sessionId:UUID}` | `{released:boolean}` |

Frame:
```json
{
  "kind": "payment",
  "items": [{"name":"ชาเขียว","quantity":2,"unitPrice":"20.00","lineTotal":"40.00"}],
  "subtotal":"40.00", "discount":"0.00", "total":"40.00",
  "received":null, "change":null, "paymentMethod":"PROMPTPAY",
  "qr":{"image":"data:image/png;base64,...","amount":"40.00","mode":"GATEWAY","expiresAt":1792491000000}
}
```
`kind` is cart/payment/completed. Monetary values are nonnegative decimal strings with exactly two decimals, never floating arithmetic; total/received/change may be null while not ready. Items max 200, name max 200 chars, positive bounded integer quantities. QR may be null; only PNG/JPEG/WebP base64 data URLs up to 200,000 characters, never remote URLs/SVG/HTML. QR amount must match total and the frame must be payment/PromptPay; Gateway requires an integer Unix-millisecond expiry, Upload requires null expiry. Completed requires confirmed total/received/change and no QR. Extra fields are rejected by Agent validation.

Unknown/legacy Agent display routes return 404 with actionable upgrade guidance in Web. Authentication failures remain 401, denied Origin/Host 403, malformed display requests 400. Safe display failures return 409 with allowlisted `code` (DISPLAY_UNAVAILABLE, DISPLAY_BUSY, DISPLAY_DISABLED, DISPLAY_STALE_UPDATE, DISPLAY_SESSION_CLOSED). Display failure never rolls back a sale or automatically reprints.

## Security, logging and persistence
Customer window is packaged local HTML, sandboxed with contextIsolation, nodeIntegration disabled, narrow IPC subscription, denied navigation/popups/permissions/network and CSP. Product names are textContent, not HTML; raster QR is validated before IPC. Bundled Prompt fonts and POSJung logo need no remote resource. Frames/QR and names/financial values stay in bounded volatile memory and are never written into Agent logs or pairing settings. Existing 30-day metadata-only log retention is retained; lifecycle and accepted/failed display requests are recorded without tokens, QR payloads, names or amounts. No DB schema, cloud API payload, Auth session namespace or stock/payment transaction is changed. Original print protocol, job deduplication, Windows print plan and pairing hashes remain compatible.

## Owner acceptance after release
1. Update Agent and pair from posjung.com; verify default/selected receipt printing still works.
2. Connect an extended second screen, detect/select it in Store settings and enable customer display.
3. Add/remove products, change quantities via catalog, apply discounts/coupon and verify quote amount.
4. Cash: enter received amount, verify estimated change; complete sale and verify confirmed totals/change, automatic printing and next-cart reset.
5. PromptPay: verify Upload and Gateway QR/amount; cancel, switch method, expire QR, close checkout and recover pending sessions. Never show another cart's pending QR.
6. Disconnect the monitor, close/navigate/logout POS, close/restart Agent and interrupt connectivity; verify no stale items/QR remain after the bounded lease. Test multi-tab ownership and reconnect.
7. Repeat on actual Windows/macOS target hardware. Test installers are not developer-signed/notarized; signing remains separate from this feature.

## Validation — 2026-10-20
- Web typecheck and production build pass. Targeted Web checks: 18 tests across model/protocol compatibility, ordered/coalesced sessions, existing printer client and LINE isolation.
- Native checks on macOS: 19 pass, two Windows-specific checks intentionally skipped locally; the release matrix executes these on Windows. Existing receipt smoke plus sandboxed customer-window smoke pass. Layout assertions keep QR entirely visible at 1280×600, 1280×720 and 1280×1080.
- Browser integration uses actual Web source and Agent HTTP/controller with a disposable local auth/catalog/payment fixture and simulated screens: paired device, primary screen disabled, external selection/save, cart synchronization, quoted cash/change, confirmed cash sale with one print submission/next-cart reset, uploaded QR, Gateway QR/countdown/expiry and clearing on leaving POS were verified. QR data is explicitly non-payable; no production sale/payment or physical print was submitted.
- Full baseline regression uses an isolated Git snapshot to retain pre-existing locally deleted tests without staging/restoring those deletions. Local database emulator timeouts are distinguished from feature assertions; GitHub Platform checks remain the release gate.
- Actual Windows/macOS extended-monitor and thermal-printer UAT remains pending owner installation.

## Release evidence
- GitHub [Platform checks](https://github.com/zoneidea/POS-Minimals/actions/runs/39407490043) passed for `3fd8b23`, including generated-contract consistency, typecheck, full tests and production build. Local full regression collected 473 tests; the database timing-only failure on the loaded workstation is superseded by this clean CI pass.
- [Print Agent installers](https://github.com/zoneidea/POS-Minimals/actions/runs/39407507776) passed on Windows x64, macOS Intel and macOS Apple Silicon, including both Electron smoke tests and the platform-specific native checks.
- [Agent 1.1.0 release](https://github.com/zoneidea/POS-Minimals/releases/tag/print-agent-v1.1.0) publishes all three installers and SHA256SUMS.txt. Installer checksum entries match GitHub's published SHA-256 asset digests; Web download URLs target this release.
- Final settings controls were visually checked in desktop light/dark themes and a 390px same-origin iframe; native customer QR was checked at 1280×720. On-device UAT remains required as listed above.

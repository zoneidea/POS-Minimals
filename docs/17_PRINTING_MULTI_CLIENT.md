# 17 — Universal Receipt Rendering & Printing per Client

> **Scope status: REFERENCE / FUTURE PHASE ONLY.** React Web App and Express API are the sole Phase 1 deliverables. Native client implementation, SDK generation, installer, device printing and cross-client CI are not authorized by this document.

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Principle
**Shared receipt data, separate renderers/adapters.** Backend finishes sale (and preserves snapshots) before a printing attempt. Printing failure never rolls back a committed sale; reprinting must NEVER create a second sale.

## Receipt JSON v1
`GET /api/v1/sales/:id/receipt` returns `data` in JSON `receiptSchemaVersion:1`, with `saleId`, `saleNo`, `completedAtUtc`, `store{name,address,phone,taxId,vatEnabled,vatRate,footer}`, `cashierName`, `items[{barcode,productName,quantity,unitPrice,discountAmount,lineTotal}]`, `totals{subtotal,discount,vat,total,received,change}`, `paymentMethod`, `saleStatus`. All amount values decimal strings, no live product references needed for reprint. Scope via org membership + sale visibility rule.

## Adapters
| Client | Default adapter | Silent print feasibility | Dependencies |
|---|---|---|---|
| Web Chrome | HTML/CSS `window.print()` 80mm | Configured kiosk printing on managed desktop Chrome, not mobile | Printer installed as OS default/selected profile |
| Web Other Browser | HTML/CSS print dialog | No universal silent print | OS browser print services |
| JavaFX | JavaFX `PrinterJob` / Java Print Service | Supported on installed native application subject to driver & OS | Installed OS printer/driver; optional ESC/POS raw adapter |
| Android/iOS | OS Print Framework/AirPrint or optional Hub | Requires platform-specific integration/print hub | OS support, compatible printer or bridge |

## Printer-neutral API contracts
- Backend stores **business receipt snapshot**, never raw ESC/POS or image raster only. Renderer wraps to 58/80 mm, font size, locale, alignment and VAT format.
- Web auto print can call `window.print()` when sale commit is confirmed; in Chrome shortcut `--kiosk-printing` on Windows only where admin configures printer/profile. Other browsers/mobile may show dialog.
- JavaFX local printer configuration (printer name, paper width, renderer, auto print, retry queue) belongs **locally to the device**; not in Supabase settings until multi-station settings feature is approved.
- Use Java PrinterJob/Java Print Service if OS printer driver available. Raw ESC/POS optional for compatible models, especially cutter/drawer and paper feeds. Validate Thai by testing code page or render receipt as raster when necessary.
- Mobile without Print Hub can show receipt preview + system print dialog or download/share; no promise to force arbitrary USB/Bluetooth printing from a PWA/browser.

## Print state machine (client only)
`NOT_REQUESTED -> PREPARING -> SENT_TO_OS -> REPORTED_COMPLETE | FAILED | UNKNOWN`. Printer spool acknowledgement is not evidence that paper physically exited printer. Save local reprint metadata `{saleId,receiptVersion,deviceId,printAttempt}`; never store passwords or private payments.

## Acceptance checks
- **Phase 1 required:** Same saved sale JSON and totals in Web receipt, including Thai characters, VAT, discount, PromptPay flag; Java rendering deferred.
- Printer unplugged/out of paper -> sale remains COMPLETED, visible retry print; no duplicate checkout.
- **Phase 1 required:** Print 80mm using managed Chrome kiosk and/or browser print dialog with actual thermal printer; JavaFX driver test deferred.
- `VOIDED` printout shows status/void marker appropriately when reprinting after void, without retroactively editing immutable original completed receipt fields.
- **Future only:** Native app print queue never executes business mutation; reprint calls only GET receipt.

# 04 — UX/UI Specification

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Visual & responsive baseline
- สไตล์: modern minimal retail POS; accent หลัก 1 สี + neutral; Light/Dark ตาม `data-theme`/CSS tokens
- ใช้ Tailwind CSS, responsive typography, visible focus, high-contrast, touch target >=44px, Thai number/THB formatter
- Layout: desktop >=1024px สอง panel; tablet 768–1023px ใช้ split adaptable; mobile <768px tab/segmented สลับ `สินค้า`/`ตะกร้า & ชำระเงิน` โดยคง state
- Skeleton loaders เมื่อโหลดแรก; spinner/disable button ขณะ submit; toast + inline error; empty states + retry

## 2. Page: POS `/pos`
### Desktop 2-panel
**Left (product discovery, 60%)**
- Search input autofocus optionally, barcode scanner input, clear/search hint; รองรับ keyboard wedge scanner (Enter หลังสแกน)
- Category shortcut chips horizontally scrollable
- List/Grid toggle; Grid card: image, product name, sale price, stock badge; List row: name/barcode/price/status
- Filter active category, pagination หรือ infinite scroll (API server-side), skeleton

**Right (checkout, 40%)**
- Cart rows: ชื่อ, price, qty +/-/remove, line total; persist across route/refresh
- Totals: subtotal, fixed discount THB numeric input default `0`, VAT breakdown, payable prominent
- Payment tabs: Cash / PromptPay
- Cash: number entry + quick amount buttons `20`, `50`, `100`, `500`, `1000` (increment), `Exact`, `Clear`, `⌫`; แสดง received, change immediately
- PromptPay: Request server quote -> display QR + server amount -> manual confirmation checkbox/button; if quote goes stale, block checkout and require reconciliation; no bank-verification claim
- Confirm Sale button disabled on invalid/insufficient/stale/pending; success -> receipt preview/print dialog

### Phone
- Header with search and cart quantity badge; product area default; sticky bottom total and `ดูตะกร้า` button
- Slide-over/fullscreen checkout; Numpad finger-friendly; avoid modal stacking
- Warn when changing org/account with non-empty cart; reload validation when app resumes

## 3. Page: Inventory `/inventory` (OWNER)
- Table desktop: thumbnail, barcode, name, category, qty, cost, sale price, actions; mobile as cards
- Filters/search + low-stock red badge `0–5` (0 = หมด); table pagination; sticky controls
- Add/Edit drawer: inputs numeric initial value `0`; category dropdown, barcode, photo upload with preview
- Stock Adjust dialog: current qty, signed delta, resulting qty, required reason, confirm
- Import button: `Download Excel Template` -> upload `.xlsx` -> validation preview, row error list -> confirm import
- `Audit History` side panel + before/after diff + owner-only Reverse with conflict safeguard

## 4. Page: Categories `/categories` (OWNER)
- Name, count of products, edit/delete; prevent remove active category with active products

## 5. Page: Settings `/settings` (OWNER)
- Store identity, tax ID, address/phone, VAT switch/rate, PromptPay identifier, receipt footer text (multi-line)
- Live 80mm receipt preview; print-after-sale toggle refers to dialog, not silent printing

## 6. Page: Reports `/reports` (OWNER/ACCOUNTANT)
- Segmented report types: sales, inventory, low-stock, stock valuation
- Sales date presets day/week/month/year + custom range and cashier filter; display gross, discount, net, void
- Excel Export with current filters and loading
- Clear note `ข้อมูลการขายใช้ Snapshot ณ เวลาขาย` and `รายงานต้นทุนค้างสต็อกใช้ต้นทุนปัจจุบัน`

## 7. Page: Dashboard `/dashboard` (OWNER)
- Today sales, month sales, bill count, low-stock count, Cash vs PromptPay, Top products and quick links
- Explicit loading/empty/error; avoid running all raw transactions client-side

## 8. Page: Users `/users` (OWNER)
- Invite employee/accountant by email, role, status; suspend/reactivate; no password display

## 9. Auth `/register`, `/login`
- Register fields store name, email, username (display), password, password confirmation
- Email unique, friendly duplicate error; password strength, never reveal others' passwords
- Login uses email+password; upon success show correct org profile, role-based landing page

## 10. Thermal receipt 80 mm
**Flow:** successful commit -> receipt endpoint -> render print-only layout -> `window.print()` if auto-dialog enabled

**Must display** Store name/address/tax ID if configured, sale no, local date/time, cashier, product snapshot + qty/price/line total, subtotal, discount, tax inclusive/excluded label, net due, method, cash received/change or PromptPay paid, footer, VOID label on reprints of voided bill

CSS: `@page { size: 80mm auto; margin: 0; }`, receipt content width adapt to printer's printable area (~72mm; verify hardware), font legible, no grids/borders that clip Thai glyphs; test 80mm real device or emulator.

**Important:** Browser `window.print()` opens browser/system dialog. Truly unattended/silent printing needs supported kiosk policy or installed local print agent/bridge and must be an explicit extra feature.

## 11. Persisted cart specification
- Zustand persist in localStorage key = `pos-cart:v1:<orgId>:<userId>`; only productId, qty, original display metadata, updatedAt; **no auth token/payment credentials**
- Restore after reload/route changes; reset on completed sale or user action; never share cart across accounts/orgs
- On checkout server validate inventory and recalculate price; `409 CART_STALE` prompts review
- If localStorage unavailable, retain in-memory cart and inform user persistence unavailable

## 12. UI states to implement on every async page
`INITIAL_LOADING`, `READY`, `EMPTY`, `FETCH_ERROR`, `BACKGROUND_REFRESH`, `SUBMITTING`, `SUBMIT_SUCCESS`, `SUBMIT_ERROR`, `NO_PERMISSION`, `SESSION_EXPIRED`.


## Shared API impact on React Web UI
- React reads/writes through `packages/api-client` generated/validated from `contracts/openapi.yaml`, not Supabase table SDK. Supabase client use is limited to **Auth**; Supabase Storage upload only through authorized backend-issued signed intent.
- Client bootstrap: signUp via Supabase Auth -> authenticated `POST /orgs/bootstrap`; login -> `GET /auth/me` -> role-aware navigation.
- A backend API error `SESSION_EXPIRED`, `CART_STALE`, `INSUFFICIENT_STOCK`, `VERSION_CONFLICT`, `RATE_LIMITED` must map to visible loading/error/retry states. `X-Client-Platform: WEB` is telemetry only.
- Phase 1 Receipt display consumes normalized JSON returned by API; implement **Web HTML/CSS renderer 80mm**. Native JavaFX renderer is deferred and may reuse the same business snapshot in future.
- Phase 1 carts are per user+org+browser device local drafts (not synchronized across devices); stock & sales are shared/transactional. Future JavaFX sign-in is a design constraint only, not a Web Phase 1 deliverable.

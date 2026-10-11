# 13 — Open Decisions / Assumptions Register

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

> เอกสารอื่นใช้ค่า **Proposed Default** ต่อไปนี้เพื่อให้ทีมเริ่มทำงานได้โดยไม่ต้องค้างรอคำตอบ เมื่อ OWNER/PO เปลี่ยนค่า ให้ update PRD, contract, tests พร้อมกัน

| ID | Topic | Proposed default | Why / Action before release |
|---|---|---|---|
| D01 | Username ซ้ำได้และ login อย่างไร | ใช้ email+password ที่ unique; username เป็น display name ซ้ำได้ | การใช้ username ซ้ำเพื่อ login จะระบุตัวตนไม่ได้; ต้องไม่ใช้เป็น unique login key |
| D02 | Password ห้ามซ้ำ | **ไม่บังคับ unique ข้ามผู้ใช้**; password hashed by Supabase Auth, strength policy | การเปรียบเทียบ cross-user passwords มี privacy/security tradeoff; ถ้าหมายถึงไม่ใช้ซ้ำกับ password เดิมของตนเองค่อยกำหนด policy แยก |
| D03 | One org ต่อ account หรือ multi-org | MVP user active membership หนึ่งร้าน | ลดความซับซ้อน; schema รองรับ extension ภายหลัง |
| D04 | คำนิยาม 1 วันย้อนหลัง | 24 ชม.จาก `completed_at` UTC (ไม่ใช่วันปฏิทิน) | Owner void เท่านั้น; แสดงเวลาสิ้นสุดสิทธิ์ใน UI |
| D05 | Quick cash amounts | 20/50/100/500/1000 **เพิ่มยอดสะสม** | มี `Exact`, `Clear`, `Backspace` |
| D06 | ส่วนลด | ลดแบบจำนวนเงินบาททั้งบิล, ไม่มี % | ลดความซับซ้อน; allocate discount บรรทัดสำหรับ reports |
| D07 | VAT on/off และวิธีคำนวณ | VAT inclusive ในราคาขาย, rate configurable, initial 7.00% placeholder | เจ้าของยืนยันรูปแบบภาษีและข้อกฎหมายที่ใช้จริงก่อน go-live |
| D08 | PromptPay payment confirmation | QR configured per store, พนักงานกดยืนยันด้วยตนเอง | ไม่มี bank confirmation; ต้องมีข้อความชัดว่าระบบไม่ได้ยืนยันเงินเข้า |
| D09 | Thermal print auto | Phase 1: Web print dialog or explicitly configured Chrome Kiosk; JavaFX/Mobile printing deferred | Browser silent printing ไม่ได้ทุกอุปกรณ์; ทดสอบกับฮาร์ดแวร์จริง |
| D10 | Barcode scope | ห้ามซ้ำภายใน org รวม soft-deleted rows; ต่าง org ซ้ำได้ | คง historical integrity, guard ด้วย DB unique |
| D11 | Low stock threshold | <=5 (0=out), สีแดงชัด | fixed; ไม่มี setting min stock ใน MVP |
| D12 | Inventory qty | จำนวนเต็ม, ปรับ qty ผ่าน delta+reason, ไม่มีติดลบ | ลดความซับซ้อนสินค้าแบบชั่งน้ำหนัก |
| D13 | Excel import mode | dry-run preview แล้ว commit all-or-nothing; duplicate existing barcode reject | ถ้าจะ update by barcode ให้ทำ feature แยกและให้ user เลือก explicit |
| D14 | Stock valuation | `current_qty * current_unit_cost` | ไม่ใช่ FIFO; รายงานใช้ต้นทุนปัจจุบัน |
| D15 | Refund after void | App ทำ void+restock; actual refund จัดการภายนอก | ไม่รองรับ bank refund API |
| D16 | Product reverse | Restore latest matching version only | ป้องกันทับการแก้ไขถัดมา |
| D17 | Product image | Manual upload via private Supabase Storage; Excel template ไม่มี image bytes | ลดความเสี่ยง URL fetch/SSRF จาก import |
| D18 | Performance capacity | เริ่ม benchmark 10 concurrent users; no TPS guaranteed | วัดผลบน deployment จริงก่อนสัญญา SLA |
| D19 | Cash sales and unpaid balance | Partial payment ไม่รองรับ; cash received >= due | backend re-validate |
| D20 | Printed receipt tax fields | ใช้ Store Settings snapshot / VAT presentation | ต้องตรวจข้อความใบเสร็จที่ใช้งานจริงกับนักบัญชี/ภาษีก่อน production |

## Technical decisions already fixed by provided requirements
- React.js + Tailwind, Express stateless, Vercel, Supabase, Node cache, Light/Dark, responsive
- ORGID unique and every business row scoped to org
- Only OWNER Dashboard + void, Accountant reports only, Employee sales only
- Soft delete master and immutable/append-only histories
- Historical sale reports unaffected by current product edits

## Approval checklist before W1 concludes
- [ ] Approve D01–D03 (identity & account ownership)
- [ ] Approve D04/D07/D08/D09 (void/VAT/PromptPay/printer)
- [ ] Approve D10–D16 (inventory/import/valuation/reverse)
- [ ] Confirm test printer model/browser/site operation for actual print-dialog testing


## Additional multi-client decisions (v2)
| ID | Topic | Proposed default | Action |
|---|---|---|---|
| D21 | API route canonical | Use `07_API_CONTRACT.md`, `/auth/me`, `/orgs/bootstrap`, `/inventory/products/*` | Adapt JavaFX old routes; **no automatic legacy aliases** unless approved |
| D22 | App platform (FUTURE ONLY) | Future Android/iOS app via shared API, framework TBD | No Mobile app implementation in Phase 1 |
| D23 | JavaFX SDK strategy (FUTURE ONLY) | When separately approved, generate Java models/client from OpenAPI | No Java SDK or Java smoke harness in Phase 1 |
| D24 | Device printing | Web Browser/Kiosk; JavaFX OS/native adapter; Mobile OS Print/Hub | Choose printer models, Thai font and paper sizing by UAT |
| D25 | Desktop/mobile session | OS secret vault or re-login; secure refresh token handling | Product decides remember-me semantics; no plaintext credentials |
| D26 | Multi-device carts | Per user+org+device draft only, not synchronized across devices | Sale/stock are shared and require revalidation at checkout |
| D27 | Version compatibility | `/api/v1` backward compatible, GET `/client/config` minimum client version | Set support window after first native release |
| D28 | Public domain | Production API needs stable public HTTPS endpoint reachable by clients | Provision before installed client distribution |

## Fixed project/repository and delivery decisions (confirmed 2026-10-11)
- **D29 (fixed):** GitHub source repository `https://github.com/zoneidea/POS-Minimals.git` (owner `zoneidea`, name `POS-Minimals`, default branch `main` when inspected). Maintain Web/API in this one repository.
- **D30 (fixed):** Phase 1 implements only React Web App + Express API + Supabase. JavaFX Desktop, Android/iOS native apps, Java SDK and device-specific print agents are **out of scope** until separately approved.
- **D31 (fixed):** Separate Vercel Web and API Projects may point at the same GitHub repo using `apps/web` and `apps/api` as root directories; no separate Node.js/Express projects per client and no custom load balancer in Phase 1.
- **D32 (quality):** Phase 1 CI/UAT covers React Web + Express API + Supabase only. Preserve compatibility-minded OpenAPI design; native contract suites begin only with future native development.

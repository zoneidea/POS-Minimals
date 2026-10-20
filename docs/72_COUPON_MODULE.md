# โมดูลคูปอง/ส่วนลด — Demo

ขยายจาก UI preview ตามคำสั่งผู้ใช้ 2026-10-18 โดยคง modular monolith และ deployment เดิม

- เจ้าของกดซื้อจำลองฟรี ไม่มีการเรียกชำระเงินจริง/ต่ออายุ/หักเงินอัตโนมัติ สิทธิ์เก็บในฐานข้อมูลแยก org ไม่ใช้ localStorage เป็นสิทธิ์
- `coupons` เป็นสิทธิ์ทดลองซื้อขาด ไม่มีราคาจริง; Marketplace ยังแสดงกำลังพัฒนา
- เจ้าของสร้าง/แก้ไข/soft delete คูปอง; พนักงานใช้โค้ดขาย; เจ้าของ/บัญชีอ่านรายงาน
- คูปองมีชื่อ โค้ด unique ต่อร้าน (ไม่ใช้ซ้ำแม้ลบ), มูลค่าส่วนลดเงินบาท, วันเริ่ม/สิ้นสุดตามวันไทยรวมวันสุดท้าย, จำนวนใช้ทั้งหมด, แสดงท้ายใบเสร็จ
- ใช้ 1 โค้ดต่อบิล ส่วนลดคูปองบวก manual discount แต่รวมไม่เกินยอดสินค้า (ส่วนเกินมูลค่าคูปองไม่ทอนเป็นเงิน)
- quote ไม่จองจำนวน; checkout lock คูปองและตัด 1 สิทธิ์พร้อมขาย/สต็อกใน transaction เดียว มี idempotency
- ยกเลิกบิลตามกฎเดิม คืนสิทธิ์คูปองครั้งเดียวพร้อม audit; รายงานแยกบิลยกเลิกและไม่นับในยอดส่วนลดสุทธิ
- คูปองเปิดแสดงท้ายใบเสร็จ เฉพาะที่ยังใช้ได้ ณ เวลาขาย พิมพ์โค้ด มูลค่าและวันสิ้นสุดใน snapshot เดิม; เปลี่ยนคูปองภายหลังไม่แก้บิลเก่า
- ไม่ซื้อ/ปิดสิทธิ์ โมดูล/เมนู/รายงานถูกซ่อนและ API/RPC ปฏิเสธ; บิลเก่ายังเปิด/พิมพ์สำเนาได้ตามสิทธิ์เดิม

## API contract

ใช้ Bearer JWT/session เดิม, org derive จากสมาชิก active; no request orgId.

| Route | Payload / response | สิทธิ์ |
|---|---|---|
| GET /api/v1/marketplace/entitlements | `{coupons:boolean}` | สมาชิก |
| POST /api/v1/marketplace/coupons/demo-purchase | `{}` → `{coupons:true}` idempotent | OWNER |
| GET /api/v1/coupons?page=1 | `{items,total,page,limit:10}` | OWNER + module |
| POST /api/v1/coupons | `{name,code,amount,startsOn,endsOn,maxUses,showOnReceipt}` → coupon | OWNER + module |
| PATCH /api/v1/coupons/:id | same + `version` | OWNER + module |
| DELETE /api/v1/coupons/:id | `{version}` soft delete | OWNER + module |
| GET /api/v1/reports/coupons?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1 | usage rows, total, summary `{uses,discount}` | OWNER/ACCOUNTANT + module |

Coupon DTO: `{id,name,code,amount,startsOn,endsOn,maxUses,usedCount,showOnReceipt,version}`. Usage row: `{id,saleNo,code,name,amount,completedAt,status}`; no personal data in coupon report.

Quote/checkout/gateway initiate เพิ่ม optional `couponCode`; `discountAmount` ที่ส่งเป็น manual discount; quote ส่ง total discount + `couponDiscountAmount` และ `manualDiscountAmount`. Checkout ส่ง manual เท่านั้น, server คำนวณคูปองซ้ำ. Receipt optional `coupon` (used snapshot) และ `couponOffers` (ท้ายใบเสร็จ).

Errors: 400 validation; 403 role/module unavailable; 409 expired/exhausted/changed coupon or stale version. UI มี loading/error/empty, save success SweetAlert 1.5s, confirm เปลี่ยน/ลบ/ซื้อจำลอง, warning failure. ไม่มีปุ่มโหลดใหม่.

## Database / deployment

Additive migration `202610180001_coupon_module.sql`: org_modules, coupons, coupon_redemptions, coupon_events + RLS/read-only grants and audited RPC writes. ใช้ DatabaseInitializer เดิม. ไม่แก้ historical migration, ไม่มี provider/payment API ใหม่. ต้อง apply migration ก่อน API release. Rollback application ใช้ได้กับ schema ที่เพิ่ม; ไม่ drop ledger.

## ผลตรวจและส่งมอบ 2026-10-18

- Typecheck, generated OpenAPI types และ build ทั้ง API/Web ผ่าน
- Local suite: 40 files / 152 tests ผ่าน รวม coupon role/RLS/tenant, duplicate demo purchase, quote/checkout rollback, replay, exhausted/expired/future coupon, capped discount, immutable offers, soft delete, Gateway completion และ void reversal
- Browser ใช้ข้อมูลจำลองใน PGlite แยกจาก Supabase: ซื้อฟรีแล้วเมนูปรากฏ, สร้างคูปอง WELCOME10, quote 50→40 บาท, server checkout หักคูปอง 5→4 และรายงาน 1 ครั้ง/10 บาท
- ตรวจ desktop, มือถือ 390px, dark mode, required labels, SweetAlert และบัญชี/พนักงาน; แท็บทดสอบใหม่ไม่มี console warning/error
- Migration ใช้ DatabaseInitializer เดิมและ apply กับ Supabase development ที่ผู้ใช้ยืนยันแล้ว; ตรวจ RLS เปิดครบ 4 ตาราง, anon ซื้อไม่ได้, authenticated เรียก private checkout core ไม่ได้
- ไม่มีการซื้อโมดูล/สร้างคูปอง/ขายให้ร้านจริงระหว่างการตรวจ ยังต้อง UAT บัญชีจริงและใบเสร็จ Thermal โดยผู้ใช้
- PGlite พิสูจน์ transaction rollback/idempotency และกฎ stock แต่ไม่ใช่หลักฐาน multi-connection load/concurrency benchmark; checkout ใช้ product/coupon row locks ในลำดับเดียวกัน
- Gateway ใช้การตรวจสต็อกคูปอง ณ commit เช่นเดียวกับสินค้า ไม่จองคูปองตอนสร้าง QR หากรับเงินแล้วแต่สต็อก/คูปอง/สิทธิ์เปลี่ยน จะคงหลักฐาน payment และแจ้ง PAID_NOT_POSTED ตามขั้นตอนตรวจสอบรายการเดิม ห้ามรับเงินซ้ำ
- Coupon events/redemptions เป็น business ledger เช่นประวัติขาย/สต็อก ไม่ถูกล้างตาม retention ของ diagnostic logs


## User acceptance — 2026-10-18

ผู้ใช้ยืนยัน Pass สำหรับซื้อโมดูลจำลอง → สร้างคูปอง → ใช้ตอนขาย → ตรวจรายงาน → ยกเลิกบิลและคืนสิทธิ์คูปอง จากรายการทดสอบที่สรุปส่งให้ ไม่ใช่การทดสอบเก็บเงินจริงหรือ load/concurrency benchmark

## เปิด–ปิดโมดูลที่ซื้อแล้ว — 2026-10-20

แยก ownership (แถว org_modules ที่ซื้อแล้ว) จาก effective access (enabled) โดยใช้ตารางเดิม ไม่ลบการซื้อ คูปอง ประวัติใช้งาน หรือใบเสร็จเดิม การเปิดกลับใช้สิทธิ์ซื้อขาดเดิม ไม่เรียก purchase API และไม่สร้างการซื้อซ้ำ โมดูลจริงปัจจุบันคือ coupons แบบซื้อขาดทดลองฟรี; โมดูลรายเดือนยังเป็น preview และรอบนี้ไม่เพิ่มการซื้อ/ต่ออายุ/วันหมดอายุหรือขยายระยะเวลาสิทธิ์ใด ๆ

- GET /api/v1/marketplace/entitlements เพิ่ม `purchased:{coupons:boolean}` โดยคง `coupons:boolean` เป็นสิทธิ์ใช้งานจริงตามเดิม LINE และ client เดิมที่อ่าน coupons ยังทำงานเหมือนเดิม
- POST /api/v1/marketplace/coupons/demo-purchase ยัง idempotent; การเรียกซ้ำเมื่อซื้อแล้วและปิดอยู่ไม่เปิดกลับโดยอัตโนมัติ ส่ง ownership เพิ่มด้วย
- PATCH /api/v1/marketplace/modules/coupons รับ `{enabled:boolean}` แบบ strict ห้ามส่ง orgId; คืน `{coupons:boolean,purchased:{coupons:true}}` ใช้ Bearer/session เดิม OWNER เท่านั้น derive ร้านจากสมาชิก active
- ไม่เคยซื้อ: 409 MODULE_NOT_PURCHASED; role ผิด:403; module/flag/body ผิด:400 ไม่มีการซื้อหรือให้สิทธิ์จาก frontend/localStorage
- RPC set_org_module_enabled ตรวจเจ้าของ, lock แถว module แล้วแก้ enabled พร้อม activity MODULE_COUPONS_ENABLED/DISABLED ใน transaction เดียว คำขอสถานะเดิมไม่เพิ่ม audit ซ้ำ เก็บ acquired_at/acquired_by/source เดิม หาก audit ล้มเหลวให้ rollback
- สิทธิ์ RLS/RPC เดิมปิดเมนูคูปอง ช่องใช้คูปอง รายงาน และการใช้คูปองใหม่ที่ API แม้ frontend เก่าจะค้างอยู่ การ recover บิลที่ commit ไปแล้วและ void/คืนสิทธิ์คูปองยังทำได้ตามกฎเดิม
- Marketplace แสดง “ซื้อแล้ว · ปิดใช้งาน” และปุ่มเปิดกลับ แทนการเสนอให้ซื้อซ้ำ ใช้ SweetAlert confirm, success 1.5 วินาที และ warning error
- Provider รับผล mutation ทันทีและ abort คำขออ่านเก่า มี storage event เป็นเพียงสัญญาณให้แท็บอื่นอ่านสิทธิ์ใหม่จาก API ไม่เก็บสิทธิ์ใน browser; focus refresh เดิมยังอยู่
- Checkout ที่ยังไม่ล็อก Gateway/ยังไม่ส่งขายล้างโค้ดคูปองที่ถูกปิดและขอ quote ใหม่ ไม่แก้ input ของบิลหรือ Gateway ที่กำลังรอยืนยัน; server ยังคงเป็นผู้ตัดสินยอด/สิทธิ์
- Additive migration 202610200001_module_activation.sql ใช้ DatabaseInitializer เดิม apply ก่อน API/Web deploy ไม่มี schema drop หรือการเปลี่ยน cloud API เดิมที่บังคับ client เก่าแก้ไข

### Validation
- Typecheck, API/Web build and focused database/HTTP/Marketplace SSR checks pass. PostgreSQL tests verify owner/tenant isolation, unpurchased rejection, repeated-state audit idempotency/rollback, unchanged acquisition data and coupon counters, disabled normal cash sale, committed-sale recovery, historical report recovery and void restoration while disabled.
- Browser fixture verified one demo purchase followed by disable/re-enable with purchaseCount=1; disabled card/modal offers activation instead of buying. Two-tab Web checkout clears the coupon input when another tab disables the module. No production purchase, coupon creation, sale or module toggle was submitted during QA.
- Confirmed existing development Supabase target received only 202610200001_module_activation.sql through DatabaseInitializer. RPC privilege check: anon=false, authenticated=true, security_definer=true; function still checks active owner and org internally. Shop module flags/data were not modified.

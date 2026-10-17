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

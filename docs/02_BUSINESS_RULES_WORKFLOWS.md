# 02 — Business Rules & Workflows

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Login และ ORG Context
`Sign up -> create Supabase Auth user -> create org UUID -> create membership OWNER -> create store_settings -> ready`  
ต้อง implement ให้ provisioning retry-safe; ถ้าสร้าง DB ไม่สำเร็จห้ามขึ้นว่าร้านสมัครสำเร็จ

`Sign in with unique email -> verify JWT -> load active membership -> active org_id and role -> render allowed menus`  
หากอนาคต user มีหลาย org ให้แสดง org chooser หลัง login; แต่ MVP จำกัดสมาชิก active หนึ่ง org ต่อคนเพื่อลด UI

**เชื่อถือข้อมูล:** `org_id` จาก header/path ใช้เพื่อเลือกบริบทได้เฉพาะเมื่อ server ตรวจ membership แล้วเท่านั้น; ไม่ยอมรับ org_id ใน request body เป็นสิทธิ์ด้วยตัวมันเอง

## 2. Checkout (เงินสด)
1. พนักงานค้น/สแกนบาร์โค้ดหรือกดสินค้า -> add to cart; repeat scan เพิ่ม qty
2. แก้จำนวน/ส่วนลด -> คำนวณ subtotal, discount, VAT และ payable
3. เลือก Cash -> กรอก received หรือใช้ quick amounts; UI แสดง change = max(received - payable, 0) และ insufficiency indication
4. กดบันทึกได้เมื่อ qty >0, stock เพียงพอ, discount ถูกต้อง, received >= payable
5. Frontend ส่ง `Idempotency-Key` UUID และ items `{productId, quantity, expectedUnitPrice}` / discount / received / `expectedTotalAmount`; server ใช้ราคาจาก DB เสมอและ **เปรียบเทียบ** expected กับค่าล่าสุดเพื่อแจ้ง `CART_STALE` เมื่อเปลี่ยน
6. Backend อ่าน master ล่าสุดภายใต้ DB transaction; lock product stock **ตามลำดับ product_id ที่คงที่**; ตรวจ stock และราคา แล้วคำนวณบน server
7. Server สร้าง sale/payment/sale_items snapshots/stock_movements และ decrement qty; commit atomically
8. Frontend ล้างตะกร้า **หลังยืนยัน commit สำเร็จ**; โหลดใบเสร็จตาม sale ID; เรียก print dialog (หรือ local bridge หากมี)

**เมื่อราคาหรือ stock เปลี่ยนระหว่างเปิดตะกร้า:** คืน `409 CART_STALE` + current values; ให้ผู้ใช้ตรวจสอบและยืนยันใหม่ ไม่เงียบๆเปลี่ยนยอดหลังเลือกเงินรับ

**ถ้า network timeout หลัง submit:** เรียก status ด้วย idempotency key เดิมก่อน retry; server return previous success result ถ้าเคย commit

## 3. Checkout (PromptPay)
- เลือก PromptPay -> เรียก `POST /sales/quote` เพื่อรับยอดล่าสุดและข้อมูล QR/รหัสของร้าน; quote ไม่ได้จองสต็อก
- ต้องตั้งค่า PromptPay identifier ที่ใช้ได้ในร้าน มิฉะนั้น disable วิธีชำระ
- Cashier ตรวจสอบการโอนผ่านหลักฐานหรือแอปธนาคาร **ด้วยตนเอง** แล้วกด `ยืนยันได้รับเงิน`
- กด checkout พร้อม `expectedTotalAmount` จาก quote ล่าสุด; server คำนวณใหม่และปฏิเสธ `409 CART_STALE` หากยอด/ราคาต่าง ก่อนสร้าง sale. หากลูกค้าโอนไปแล้วแต่ราคาต่าง ให้พนักงาน/เจ้าของตรวจสอบและจัดการเงินภายนอกระบบตามขั้นตอนร้าน
- บันทึก `payment.method=PROMPTPAY`, `status=MANUALLY_CONFIRMED`, `amount=payable`, `confirmed_by`
- **ข้อจำกัด:** ระบบไม่ตรวจการโอนจริง ไม่กล่าวอ้างว่า verified by bank; auto verification ต้องมี bank/gateway integration ใน phase ต่อไป

## 4. Amount, Discount, VAT
- Qty เป็นจำนวนเต็มบวกใน MVP; แสดงราคาเงินไทย 2 ทศนิยม
- `subtotal = SUM(qty * price_at_checkout)`
- `discount_amount` เป็น THB fixed per bill, default 0; `0 <= discount_amount <= subtotal`
- `total = subtotal - discount_amount` (จำนวนเงินที่ลูกค้าชำระ; VAT inclusive หากเปิดใช้)
- เมื่อ VAT on: `vat_amount = round(total * rate/(100+rate), 2)`; `net_before_vat = total - vat_amount`; rate snapshot ณ ขาย
- เมื่อ VAT off: VAT = 0; rate snapshot = 0
- ส่วนลดระดับบิลที่ต้องกระจายไป sale line/report ให้ใช้ proportional allocation แบบ integer satang พร้อม assign remainder ไป line สุดท้ายเพื่อรวมตรงยอด
- เงินทอน CASH `received - total >=0`; PROMPTPAY change=0
- ค่าตัวเลขใน form เริ่ม 0, ไม่รับ NaN/Infinity/ค่าติดลบ (ยกเว้น qty delta ลดสต็อก)

## 5. Inventory Adjustment / Editing
- `quantity_on_hand` integer >=0; stock delta บวกหรือเป็นลบและ reason required
- `unit_cost`, `sale_price` NUMERIC >=0, default 0
- แก้สินค้า: `before/after` deep snapshot เฉพาะ relevant fields และ actor/metadata; เพิ่ม `row_version` ทุกครั้ง
- qty adjustment เขียน stock_movement (ADJUST_IN/ADJUST_OUT) และ audit ก่อน-หลัง transaction เดียว
- ห้ามแก้ quantity ด้วย generic product PUT โดยตรง; ใช้ `/stock-adjustments`
- รูป upload จำกัด mime type, size, scan/validate content ตามนโยบาย; เก็บ Storage path ไม่ใช่ base64 ใน DB

## 6. Reverse Product Changes
- เจ้าของเลือก audit event ที่ปรับสินค้า แล้วกด Reverse
- Server โหลด audit event, ตรวจ org, role และ `current.row_version == event.after_version` เพื่อกันทับการแก้ครั้งใหม่
- คืนค่าเฉพาะ field ที่เปลี่ยนจาก before snapshot; สำหรับ quantity **ต้องสร้าง compensating stock movement** (ห้ามเขียนตัวเลขดิบทับ)
- Reverse เขียน new audit event `REVERSE`, เชื่อม `reversed_event_id` และเพิ่ม version ใหม่; event ต้นฉบับไม่ถูกลบ
- หาก version เปลี่ยนแล้ว return 409 พร้อมให้ทบทวน/ปรับ manual; ห้าม restore อัตโนมัติโดยทับข้อมูลปัจจุบัน

## 7. Sale Cancellation (VOID)
`OWNER -> choose sale -> check now - completed_at <= 24h -> reason -> confirm -> DB transaction with locks -> void status -> reverse each sale stock movement once -> append audit -> commit`

- ถ้าขายไปแล้ว 24h + 1 วินาที return `VOID_WINDOW_EXPIRED`; ใช้เวลา UTC ของ server เป็นเกณฑ์
- `VOIDED` sale ไม่ถูกลบ; เก็บ `voided_at`, `voided_by`, `void_reason`
- มูลค่ายอดขายสุทธิรายงานไม่นับ VOIDED และมีตัวชี้วัด void แยก; รายงาน gross / net ต้อง label ชัด
- ไม่ถือเป็นการคืนเงินจริงไปยังลูกค้า: คืนเงินสด/PromptPay เป็นขั้นตอนภายนอกโดยเจ้าของใน MVP; ระบุใน UI ชัด

## 8. Reports & Historical Truth
- ตอนขาย snapshot `product_name, barcode, category_name, unit_price, unit_cost, qty, allocated_discount, line_total, tax` ทั้งหมด
- Store receipt snapshot (`store_name`, address, tax id, footer, VAT config) และ actor snapshot (`cashier_name`) ณ transaction เพื่อไม่เปลี่ยนอดีต
- ต้นทุนสินค้าค้างสต็อก = `SUM(current_qty * current_unit_cost)` และระบุว่าเป็น **current cost valuation** ไม่ใช่ FIFO/ต้นทุนซื้อจริงตามล็อต
- ช่วงวันรายงานตัดตาม `Asia/Bangkok`, แปลงช่วง start/end เป็น UTC ก่อน query; ใช้ end-exclusive

## 9. Soft Delete Semantics
- Product/category/membership/configurable master: `deleted_at`, `deleted_by`; default queries filter active
- Sale/Payment/Stock Movement/Audit: **append-only / state transition**; ห้าม physical delete; สำหรับ sale void ใช้ status
- ห้าม soft-delete ผลิตภัณฑ์ทำให้ snapshot ประวัติหาย
- Barcode อดีตของ org ที่ soft-deleted แล้วคงถูกจองไว้ ไม่ reuse ใน MVP

## 10. Concurrency Rules
- Checkout และ stock adjustment/void ใช้ atomic DB transaction และ row locks; cache ห้ามเป็น source of truth
- Stock must never drop below zero; enforce DB constraint + transactional validation
- Same `idempotency_key` within same org/action must produce the same result; key reuse with different request hash => `409 IDEMPOTENCY_CONFLICT`


## Client-agnostic workflow contract
Checkout, price, VAT, discount, stock movements, 24-hour void, reverse and historical snapshots are fully implemented in Express/PostgreSQL for the Web App now and future clients without changing backend business rules; do not compute final authoritative totals or write inventory changes in client code. All clients pass expected price/version and receive the same stable conflict codes; print only after persisted sale response or reconciled prior checkout.

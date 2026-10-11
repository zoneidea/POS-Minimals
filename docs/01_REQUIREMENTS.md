# 01 — Product Requirements Document (PRD)

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. เป้าหมายและกลุ่มผู้ใช้
- POS สำหรับร้านค้าขนาดเล็กที่ต้องการความเร็วและใช้งานได้ทันที
- SaaS หลายร้านใช้ platform ร่วมกันแต่แยกข้อมูลทั้งหมดตาม ORGID
- Roles: `OWNER`, `EMPLOYEE`, `ACCOUNTANT`
- เป้าหมาย UX: ทำรายการขายตั้งแต่เลือกรายการจนรับชำระเงินได้โดยไม่เปลี่ยนหน้าหลัก
- **Phase 1 พัฒนาเฉพาะ React Web App + Shared Express API + Supabase** ใน Repository `zoneidea/POS-Minimals`; วาง API แบบ future-ready สำหรับ JavaFX/Desktop/Mobile ภายหลัง แต่ยังไม่พัฒนา Native Client/SDK; Browser ไม่มีสิทธิ์ทำ business mutation กับ Supabase DB ตรง

## 2. Functional Requirements

### FR-AUTH สมัคร/ล็อกอิน/สมาชิก
- FR-AUTH-01 สมัครด้วยชื่อร้าน, อีเมลไม่ซ้ำ, username ซ้ำได้ (ชื่อแสดงผล), password
- FR-AUTH-02 สร้าง `org_id` UUID unique โดย server/database; สมาชิกผู้สมัครเป็น OWNER เริ่มต้น
- FR-AUTH-03 Login ด้วย **อีเมลและรหัสผ่าน** ไม่ใช้ username ที่ซ้ำได้เป็น identity
- FR-AUTH-04 มี `organization_members` เชื่อม user↔org พร้อม role; ทุก request รู้ org ที่อนุญาตจริง
- FR-AUTH-05 OWNER เพิ่ม/เชิญ/ระงับพนักงานและบัญชีได้; ผู้ใช้รับเชิญต้องสร้าง password เอง
- FR-AUTH-06 สมัครผ่าน Supabase Auth (verify email ตาม config) แล้วเรียก authenticated `/orgs/bootstrap` แบบ idempotent; ต้องมี recovery/compensation สำหรับการสร้าง Auth user กับ org ที่ไม่ได้เป็น distributed transaction
- FR-AUTH-07 Password จัดการโดย Supabase Auth (password hash, reset, verify); **ไม่เก็บ plaintext** และไม่เช็กความซ้ำข้ามคนด้วยการเปิดเผยรหัสผ่าน

### FR-POS หน้าขาย
- FR-POS-01 Layout 2 Panel: ด้านหนึ่งสินค้า/หมวดหมู่/ค้นหา อีกด้านตะกร้า/สรุป/numpad/ชำระเงิน
- FR-POS-02 สลับรูปแบบการแสดงสินค้า `LIST`/`GRID`; GRID มีรูป ชื่อ ราคา
- FR-POS-03 Shortcut หมวดหมู่; สแกนบาร์โค้ดหรือค้นหาด้วยชื่อ/บาร์โค้ด; รองรับ keyboard barcode scanner
- FR-POS-04 ตะกร้าแก้จำนวน/ลบรายการได้ก่อนชำระ, รวมราคาทันที
- FR-POS-05 ส่วนลด manual แบบจำนวนเงินบาทต่อบิล; validate 0 <= discount <= subtotal
- FR-POS-06 ชำระเงิน `CASH` และ `PROMPTPAY` เท่านั้น (MVP)
- FR-POS-07 Numpad ใส่จำนวนเงินรับ; shortcut 20, 50, 100, 500, 1000 เพิ่มยอดสะสม; Clear/Backspace/Exact amount
- FR-POS-08 คำนวณเงินทอนทันที; เงินสด received < total ต้องกดชำระไม่ผ่านทั้ง frontend/backend
- FR-POS-09 PromptPay ต้องขอ server-side quote เพื่อแสดงยอด/QR ปัจจุบัน และให้พนักงานกดยืนยันชำระด้วยตนเอง; ห้ามบันทึกว่าโอนจริงจากแค่การแสดง QR
- FR-POS-10 บันทึก sale สำเร็จด้วย transaction เดียวกับการตัด stock, snapshots, payment, stock movements; server ต้องตรวจว่า `expectedTotalAmount` และ `expectedUnitPrice` ตรงกับค่าที่คำนวณล่าสุดก่อน commit
- FR-POS-11 ตะกร้า Web ผูกกับ user+org+device ไม่หายเมื่อ refresh/เปลี่ยนหน้า; client อื่นในอนาคตเลือกการเก็บ draft cart ตาม platform; restore ต้อง revalidate สินค้า ราคา และ stock ณ checkout
- FR-POS-12 ใบเสร็จย่อ thermal 80 mm มีข้อมูลร้าน, เวลา, เลขบิล, พนักงาน, รายการ, ส่วนลด, VAT, ยอดรับ, ทอน, วิธีชำระ, ท้ายใบเสร็จ
- FR-POS-13 หลัง commit sale สำเร็จ React Web เริ่มกระบวนการพิมพ์: Web print dialog / Chrome Kiosk (เครื่องที่ตั้งค่า); JavaFX/Mobile printer adapters ถูกเลื่อนไป Phase ถัดไป; ห้ามพิมพ์รายการที่ยังไม่ commit และห้าม re-checkout เพื่อพิมพ์ซ้ำ
- FR-POS-14 มีสถานะ `loading`, `submitting`, `success`, `error` และป้องกันการกดบันทึกซ้ำ

### FR-PROD คลังสินค้า
- FR-PROD-01 ตารางสินค้า: barcode, ชื่อ, หมวดหมู่, คงเหลือ, ต้นทุน, ราคาขาย, รูป
- FR-PROD-02 เพิ่ม/แก้/soft delete โดย OWNER; barcode **unique ภายใน org รวมถึงที่ soft-deleted** (ไม่อนุญาต reuse ใน MVP)
- FR-PROD-03 ปรับ qty แบบ delta (+/-) พร้อมเหตุผล; ระบบบันทึกก่อน-หลัง; ไม่ให้ติดลบ
- FR-PROD-04 แก้ชื่อ, barcode, category, sale price, unit cost, รูป; ตัวเลขในแบบฟอร์มเริ่มต้นที่ `0` (ไม่ใช้ null/ว่าง)
- FR-PROD-05 อัปโหลดภาพสินค้าเข้า Supabase Storage โดยกำหนดขนาด/ชนิดไฟล์ที่ยอมรับ
- FR-PROD-06 Import Excel `.xlsx`, validate barcode, number, category, duplicate, org boundary; มีปุ่ม Download Template และ Preview Errors
- FR-PROD-07 เมื่อแก้ไขทุกครั้งต้องบันทึก audit snapshot Before/After และผู้แก้; reverse ต้องสร้าง log ใหม่
- FR-PROD-08 สินค้าคงเหลือ <=5 แสดงสถานะสีชัดเจน; 0 ให้เห็นว่า Out of stock

### FR-CAT หมวดหมู่
- FR-CAT-01 OWNER เพิ่ม/แก้ไข/soft delete หมวดหมู่
- FR-CAT-02 ชื่อหมวดหมู่ไม่ซ้ำภายใน org; ป้องกันลบหมวดหมู่ที่ยังผูกสินค้า active (หรือย้ายสินค้าก่อน)

### FR-SET ข้อมูลร้านและภาษี
- FR-SET-01 เจ้าของแก้ชื่อร้าน, ที่อยู่, โทรศัพท์, เลขประจำตัวผู้เสียภาษี (ถ้ามี), PromptPay identifier, โลโก้ (optional)
- FR-SET-02 เปิด/ปิด VAT; เก็บ rate และ tax-mode ที่มีผลกับการขายใน snapshot
- FR-SET-03 กรอกข้อความท้ายใบเสร็จและเปิด/ปิดการเปิด print dialog หลังการขาย

### FR-REPORT รายงาน (OWNER + ACCOUNTANT)
- FR-REPORT-01 ยอดขายรายวัน/สัปดาห์/เดือน/ปี; กรองพนักงาน, วันที่; export Excel
- FR-REPORT-02 รายงานคงคลัง; export Excel
- FR-REPORT-03 สินค้าใกล้หมด `stock <=5`; export Excel
- FR-REPORT-04 มูลค่าต้นทุนสินค้าค้างสต็อก (`current_qty * current_unit_cost`); export Excel
- FR-REPORT-05 รายงานการขายต้องอ่าน snapshot ตอนขาย ไม่อ่าน product master ปัจจุบันมาแทนชื่อ/ราคา/ต้นทุน
- FR-REPORT-06 แสดงยอด Gross, Discount, Net, Voided แยกชัด; ยอดรายงานสุทธิไม่นับรายการ VOID
- FR-REPORT-07 แสดง timezone Asia/Bangkok ในกราฟ/การแบ่งวัน แต่ timestamp เก็บ UTC

### FR-DASH Dashboard
- FR-DASH-01 OWNER เท่านั้นเข้าได้; ยอดขายวันนี้/เดือนนี้, จำนวนบิล, สินค้าใกล้หมด, สรุป Cash/PromptPay, Top products (จาก snapshot)
- FR-DASH-02 ใช้ aggregated query ไม่โหลด transactions ทั้งหมดไปคำนวณใน frontend

### FR-VOID / AUDIT
- FR-VOID-01 OWNER เท่านั้น void การขาย; elapsed time <=24 ชม. หลัง completed_at (เวลา server UTC)
- FR-VOID-02 Void ทำเป็น atomic transaction: เปลี่ยน `COMPLETED`→`VOIDED`, บันทึกเหตุผล/ผู้ทำ, คืนสต็อกด้วย movements, ไม่ลบ sale history
- FR-VOID-03 ห้าม void ซ้ำ; ป้องกัน race condition; ต้องมี audit ครบ
- FR-VOID-04 ทุก master record ใช้ soft delete; business ledgers (sales, payments, stock movements, audit) ห้ามลบประวัติ
- FR-AUDIT-01 Before/After JSON เฉพาะ field อนุญาต, event type, actor, timestamp; reverse ด้วย version check

## 3. Non-Functional Requirements
- NFR-01 Tenant isolation ใน API/DB/RLS/Storage/Cache และ export ทุกเส้นทาง
- NFR-02 Stateless Express: ไม่เก็บ sessions/cart/stock authoritative ใน process memory
- NFR-03 Responsive mobile/tablet/desktop; Light/Dark; accessible contrast และ touch targets
- NFR-04 ทุกหน้าที่ fetch มี initial loader, background refresh, error/empty state, retry
- NFR-05 เงินใช้ PostgreSQL NUMERIC(14,2) หรือ integer satang (เลือก consistent), ไม่คำนวณด้วย floating point แบบสุ่มผิดเศษสตางค์
- NFR-06 DB transaction + idempotency key ป้องกัน double charge/stock duplicate
- NFR-07 TLS, validation, RBAC, least privilege, RLS, audit, rate limit, no PII secrets in logs
- NFR-08 ใช้ Node local cache เฉพาะ metadata, TTL และ tenant-qualified keys; correctness ต้องไม่พึ่ง cache
- NFR-09 แยกโค้ดตาม module; automated tests, migrations, documented deployment; ทุก HTTP DTO ถูกกำหนดใน OpenAPI และมี Web/API contract tests; JavaFX/Mobile contract suites เลื่อนไป Phase ที่พัฒนาแต่ละ Client
- NFR-10 Performance targets เป็น **เป้าหมายเริ่มต้นต้อง benchmark**: API read p95 <500ms, checkout p95 <1.5s ภายใต้ scenario 10 concurrent users (ไม่รวม network/print dialog)

## 4. Out-of-scope
Purchase orders, supplier, FIFO/expiry, multi-branch, auto-confirm bank transfer, offline mode, split payment, loyalty, full accounting ledger, advanced barcode label printing.

## 5. Business acceptance
ดูรายละเอียด case แยกใน `10_TEST_ACCEPTANCE.md`; ทุก FR ต้อง map กับ test และผ่าน UAT ก่อน production.


## 6. Cross-Client / Shared API Requirements (added 2026-10-11)
- **FR-API-01** Phase 1 Web เรียก REST API v1; JavaFX Desktop และ future mobile application จะใช้ REST API เดียวกันเมื่อมีการอนุมัติ Phase ถัดไป; ห้าม Client ต่อ PostgreSQL โดยตรงหรือฝัง service-role/DB credentials
- **FR-API-02** ใช้ stable endpoint/DTO/error envelope (camelCase JSON, monetary decimal strings, IDs UUID, timestamps UTC ISO-8601) และ API versioning `/api/v1`
- **FR-API-03** Authentication ด้วย Supabase Auth JWT; Server ตรวจ signature, expiry, active membership, ORGID, RBAC ทุก request; `X-Client-Platform` เป็น metadata ไม่ใช่สิทธิ์
- **FR-API-04** Backend ต้องไม่ใช้ Referer/Origin เป็น identity (CORS เป็น browser constraint); native HTTPS clients เป็น future compatibility design ไม่ใช่งาน implement รอบนี้
- **FR-API-05** Client ทุกประเภทต้องใช้ `Idempotency-Key` เดิมเมื่อ retry checkout ที่ผลไม่ชัดเจน และ reconcile ผ่าน endpoint ตรวจสถานะ
- **FR-API-06** Receipt API ส่ง immutable receipt snapshot JSON; renderer และ print logic อยู่ที่ client, backend ไม่พิมพ์ USB/LAN printer จาก Vercel
- **FR-API-07** Phase 1 Web รองรับ Upload, XLSX export, cache, paging, error codes และสิทธิ์ผ่าน REST API; การทำ fallback ตาม native client capability เป็นงาน future phase
- **FR-API-08** Phase 1 ต้องมี TypeScript/OpenAPI + HTTP schema contract tests สำหรับ Web/API; Java/mobile contract tests และ client-specific upgrades เป็นงาน Phase ถัดไป

### Scope note
**8-week baseline รวม React Web + Express API + Supabase เท่านั้น**; ไม่มี JavaFX integration harness/SDK/GUI, ไม่มี Native Mobile App หรือ mobile SDK. Future-ready API contract เป็นข้อกำหนดเชิงสถาปัตยกรรม ไม่ใช่งาน implement Client เพิ่ม.

# 03 — RBAC / User Access

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## Role definitions
- `OWNER`: จัดการทุกอย่างในร้านของตัวเอง
- `EMPLOYEE`: ขาย/รับชำระ/พิมพ์ใบเสร็จจากบิลที่ตนเพิ่งขาย และอ่าน product/catalog แบบ read-only เพื่อขาย
- `ACCOUNTANT`: ดูรายงานทั้งหมดและ export Excel เท่านั้น ไม่ดู Dashboard (ตาม requirement เจ้าของเท่านั้น)

## Access matrix
| Ability / Page | OWNER | EMPLOYEE | ACCOUNTANT |
|---|:---:|:---:|:---:|
| Login / logout / own profile | ✅ | ✅ | ✅ |
| Product catalog for POS (read only) | ✅ | ✅ | ❌ |
| Create sale / accept cash or PromptPay / print receipt | ✅ | ✅ | ❌ |
| Edit/delete product / stock adjust / Excel import | ✅ | ❌ | ❌ |
| Product categories management | ✅ | ❌ | ❌ |
| Store Settings, VAT, PromptPay, receipt footer | ✅ | ❌ | ❌ |
| Invite/manage users and roles | ✅ | ❌ | ❌ |
| View inventory/report/dashboard data for operations | ✅ | ❌ | ❌ |
| Reports + Excel export | ✅ | ❌ | ✅ |
| Dashboard | ✅ | ❌ | ❌ |
| Void sale within 24h | ✅ | ❌ | ❌ |
| View audit log / reverse product changes | ✅ | ❌ | ❌ |

**หมายเหตุ:** ACCOUNTANT มีสิทธิ์เข้าถึงข้อมูลคลัง *ผ่านรายงานสินค้าคงคลัง* ได้ แต่ไม่ได้เข้าหน้า Inventory เพื่อแก้ไข; EMPLOYEE สามารถเห็น stock/status ที่จำเป็นในหน้าขายเพื่อป้องกัน oversell แต่ไม่เข้าหน้าบริหารสินค้า

## Menu visibility
- OWNER: Dashboard, POS, Inventory, Categories, Reports, Store Settings, Users, Audit Logs
- EMPLOYEE: POS (+ sale receipt success view)
- ACCOUNTANT: Reports

## Invite/manage staff workflow
1. OWNER ระบุ email และ role EMPLOYEE/ACCOUNTANT -> backend สร้าง invitation/สมาชิก pending (ใช้ Supabase Auth admin methods เฉพาะ backend)
2. ส่ง invite หรือกำหนด activation flow ที่ปลอดภัย; staff เลือก password ด้วยตนเอง
3. เมื่อ auth สำเร็จ backend ตรวจ membership `ACTIVE` เท่านั้น
4. OWNER suspend staff => เรียก API ของ role ต้องถูกปฏิเสธทันทีโดยตรวจ membership ทุก request (ไม่พึ่ง claims ที่ค้าง)
5. ห้าม OWNER ลบหรือระงับเจ้าของคนสุดท้ายของร้าน

## Authorization architecture
- Navigation guards ป้องกันเฉพาะ UX ไม่ใช่ security boundary
- ทุก API ตรวจ JWT, membership, org, role
- RLS ตรวจ uid↔org ownership และ least privilege เพิ่มชั้นป้องกัน
- Tenant IDs ที่ฝั่ง client ส่งไม่สามารถใช้แทนการตรวจ membership
- การ export Excel และ signed storage URL ใช้ RBAC/RLS เช่นเดียวกับหน้าแสดงผล


## Multi-client authorization uniformity
Phase 1 implement roles in React Web + Express only. Future JavaFX/Mobile must reuse the same role semantics. Hiding a JavaFX toolbar or Android button is UX only; server authorization + RLS blocks the operation. `GET /auth/me` is the canonical source for client navigation. Never assign a different role because `X-Client-Platform` claims JavaFX/native. Printer access is local device capability and does not grant additional API rights.

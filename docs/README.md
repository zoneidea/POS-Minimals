# POS Minimal — เอกสารวิเคราะห์และแผนพัฒนา

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

**เวอร์ชัน:** 2.1 (Phase 1: Web App only; API future-ready)  
**ปรับปรุง:** 2026-10-11  
**ประเภท:** Multi-Tenant SaaS POS  
**สถานะ:** Scope frozen for Web-first planning; ประเด็นที่ต้องอนุมัติอยู่ใน `13_OPEN_DECISIONS.md`
**Repository หลัก:** [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals) — `git clone https://github.com/zoneidea/POS-Minimals.git`
**Implementation now:** React Web App + Express API + Supabase. **Deferred:** JavaFX GUI, Android/iOS Native App, native printer agent และ Java SDK.

## เป้าหมาย
พัฒนา POS ใหม่ **แยกจาก POS Lite เดิม** ให้มีเฉพาะหน้าขาย, คลังสินค้า, หมวดหมู่, ตั้งค่าร้าน, ผู้ใช้/สิทธิ์, รายงาน, Dashboard เจ้าของ และ Audit Logs โดยรองรับหลายร้านผ่าน `org_id` และทำงานได้บนมือถือ/แท็บเล็ต/คอมพิวเตอร์

## Stack ที่ใช้
- Web Client: React + TypeScript + Vite + Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Zustand (persist เฉพาะตะกร้า)
- Future Clients (OUT OF SCOPE): JavaFX Desktop และ Android/iOS Native Application; ออกแบบ API-first เท่านั้น ยังไม่ต้องเขียนโค้ด Client, SDK, Test Harness หรือ Installer สำหรับแพลตฟอร์มเหล่านี้
- Backend: Node.js + Express + TypeScript; stateless **API v1 สำหรับ Web App ใน Phase 1** และกำหนดสัญญาให้ขยาย JavaFX/Mobile ภายหลังได้; modular monolith, API-first + OpenAPI
- Authentication: Supabase Auth (email+password; username เป็นชื่อแสดงผลซ้ำได้)
- Database: Supabase PostgreSQL + Row Level Security (RLS)
- Files: Supabase Storage; Excel: SheetJS หรือ ExcelJS ตามการตรวจสอบไลเซนส์/ความเสี่ยงก่อนเลือก
- Node Cache: `lru-cache` สำหรับ metadata read-only อายุสั้นเท่านั้น; ไม่ใช่ cache แบบแชร์ระหว่าง instance
- Deployment: Vercel **2 Projects** (`web` และ `api`) จาก **GitHub Repository เดียวกัน** (คนละ Root Directory `apps/web` และ `apps/api`), Supabase Cloud เป็นบริการฐานข้อมูล/ยืนยันตัวตน
- Printer Phase 1: Web ใช้ HTML/CSS 80mm ผ่าน `window.print()` และ Chrome Kiosk เฉพาะเครื่องที่ตั้งค่าเอง; Print Agent/JavaFX/Mobile print adapters เป็นงานอนาคต; พิมพ์หลัง commit เท่านั้น

## ผังเอกสาร
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `00_PHASE1_REPOSITORY_SCOPE.md` | **Repository ที่ต้องใช้, Phase 1 scope, โครงสร้าง Monorepo และข้อห้ามการขยาย scope** |
| `01_REQUIREMENTS.md` | Scope, acceptance ของแต่ละฟังก์ชัน |
| `02_BUSINESS_RULES_WORKFLOWS.md` | กฎขาย/สต็อก/ยกเลิก/คืนค่าข้อมูล |
| `03_ROLES_PERMISSIONS.md` | RBAC matrix และขั้นตอนจัดการสมาชิก |
| `04_UX_UI_SPEC.md` | รายละเอียดแต่ละหน้า, responsive, loading/error, พิมพ์ |
| `05_ARCHITECTURE.md` | ระบบ, module structure, session และการ deploy |
| `06_DATABASE_DESIGN.md` | ตาราง, keys, constraints, snapshot, RLS, transaction |
| `07_API_CONTRACT.md` | **Canonical API v1** Route, payload, validation, error และ idempotency |
| `08_SECURITY_TENANCY.md` | Security controls, tenant isolation, encryption |
| `09_PERFORMANCE_CACHE.md` | Query optimization, cache, concurrency และเป้าหมาย |
| `10_TEST_ACCEPTANCE.md` | Test cases/UAT/Regression/Security/Concurrency |
| `11_DEVELOPMENT_PLAN.md` | Sprint 8 สัปดาห์, dependency, deliverables, DoD |
| `12_DEPLOYMENT_OPERATIONS.md` | Vercel/Supabase, env, migration, logging, recovery |
| `13_OPEN_DECISIONS.md` | ข้อตัดสินใจและค่าเริ่มต้นเพื่อเริ่มพัฒนา |
| `14_REQUIREMENTS_TRACEABILITY.md` | Mapping ฟังก์ชัน -> Modules/API/DB/Test/Sprint |
| `15_MULTICLIENT_API_STRATEGY.md` | API-first design รองรับ Web/JavaFX/Mobile ด้วย backend เดียว (future reference) |
| `16_CLIENT_AUTH_LIFECYCLE.md` | Login/register/token refresh; native-specific parts deferred |
| `17_PRINTING_MULTI_CLIENT.md` | Web 80mm print + future native adapters (future reference) |
| `18_API_COMPATIBILITY_MAPPING.md` | Mapping JavaFX API เก่า (future reference) |
| `19_CROSS_CLIENT_TEST_PLAN.md` | Native integration test plan (future reference) |
| `contracts/openapi.yaml` | OpenAPI 3.1 starter contract สำหรับ SDK/codegen
| `20_IDENTITY_IMPLEMENTATION.md` | Identity backend implementation evidence and remaining gates |
| `CHANGELOG.md` | รายการที่เปลี่ยนจาก v1 |
| `AGENTS.md` | ข้อกำหนดทีม/AI coding agent |
| `DEVELOPMENT_WORKFLOW.md` | Workflow coding, PR, tests และ release |

## ข้อตกลงเริ่มต้น (Default assumptions)
1. หนึ่ง `org_id` แทน **หนึ่งร้าน/กิจการ** ใน MVP; ไม่มีหลายสาขาใน org เดียว
2. ผู้ใช้ล็อกอินด้วย **อีเมลที่ไม่ซ้ำในระบบ**; username เป็น display name จึงซ้ำได้; พนักงาน/บัญชีต้องได้รับเชิญหรือสร้างโดยเจ้าของ
3. ราคาแสดงและจัดเก็บเป็น THB; ส่วนลด Manual เป็น **จำนวนเงิน** ต่อบิล; VAT on = VAT รวมในราคาขาย (inclusive); อัตรา VAT เป็น config ไม่ hard-code
4. เงินสด shortcut 20/50/100/500/1000 ทำงานแบบ **เพิ่มจำนวนเงินสะสม**; เงินทอนคำนวณทันที
5. PromptPay แสดง QR จากข้อมูลร้านและยอดบิล พร้อมให้พนักงานกด **ยืนยันการรับเงินด้วยตนเอง**; ยังไม่มีธนาคารยืนยันอัตโนมัติ
6. สามารถยกเลิกการขายภายใน **24 ชั่วโมงนับจาก `completed_at`** โดย OWNER เท่านั้น และไม่ลบข้อมูลประวัติ
7. สินค้าใกล้หมดคือจำนวนคงเหลือ **<= 5**; จำนวน 0 = หมดสต็อก
8. รับยอดสินค้ามากกว่าสต็อกที่มีไม่ได้ใน MVP; ห้ามจำนวนคงเหลือติดลบ
9. การ Import Excel ใช้ validate/dry-run ก่อน แล้วค่อย commit; แถวผิดจะไม่บันทึกจนผู้ใช้งานแก้ไข
10. Phase 1 รองรับการพิมพ์จาก React Web เท่านั้น: เปิด Print Dialog หลังขาย หรือ Chrome Kiosk Printing เมื่อร้านตั้งค่าเอง; JavaFX/Mobile printing ไม่รวมในรอบนี้

## สิ่งที่ไม่อยู่ใน MVP
- หลายสาขาภายใต้ ORGID เดียว, ซื้อสินค้า/PO, supplier, ตัดล็อต/FIFO, สมาชิก/สะสมแต้ม
- Payment gateway/bank callback/ตรวจสอบ PromptPay อัตโนมัติ
- Multi-currency, offline checkout/sync, คืนสินค้าแบบบางรายการ, multi-tender
- การจัดการ Hardware printer แบบไร้หน้าต่างพิมพ์บน browser ทั่วไป

## Reference official docs
- Vercel Express: https://vercel.com/docs/frameworks/backend/express
- Vercel Functions: https://vercel.com/docs/functions
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Storage security: https://supabase.com/docs/guides/storage/security/access-control
- Browser print: https://developer.mozilla.org/en-US/docs/Web/API/Window/print


## API-first สำหรับ Web App (รองรับการขยายในอนาคต)
**Phase 1 implement `/api/v1` สำหรับ React Web เท่านั้น**. ใช้ `07_API_CONTRACT.md` + `contracts/openapi.yaml` เป็นสัญญากลาง และหลีกเลี่ยง Web-only assumptions ที่จะทำให้เพิ่ม Native Client ยากในอนาคต แต่ **ห้ามเริ่ม JavaFX, Mobile SDK, Native Auth Adapter หรือ Installer** ใน Phase 1. ข้อมูล JavaFX routes เดิมใน `18_API_COMPATIBILITY_MAPPING.md` เป็นเอกสารอ้างอิงสำหรับ Phase ถัดไปเท่านั้น.

- Web: Vercel React ใช้ HTTPS + Bearer JWT; API CORS allowlist เฉพาะ Web origin.
- Deferred: JavaFX จะใช้ HTTPS + JWT + API เดียวกันใน Phase ถัดไป (ยังไม่ Implement หรือ Test UI).
- Deferred: Android/iOS ในอนาคต; ไม่รวมพัฒนา Native App, SDK, printing bridge หรือ client-specific UAT ในแผน 8 สัปดาห์.
- Supabase Auth เป็น identity provider; business mutation/query ทั้งหมดต้องผ่าน Express; **service role ไม่อยู่ใน client ทุกชนิด**.
- Backend ใช้ `org_id` ที่ derived จาก verified identity+active membership ไม่เชื่อค่า ORGID ที่ client ส่ง.
- `GET /auth/me` และ `POST /orgs/bootstrap` เป็น canonical; หน้าเว็บ signup ทำ Auth signup แล้ว bootstrap ไม่ส่ง password ให้ Express.

## Read performance verification

[50_READ_PERFORMANCE.md](50_READ_PERFORMANCE.md) documents the five read-path fixes, API compatibility, development migration, local benchmark evidence and remaining staging checks.

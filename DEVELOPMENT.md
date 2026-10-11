# ข้อกำหนดการพัฒนาและ Deploy

## Frontend และ Backend ในโปรเจกต์เดียว

ผู้ใช้กำหนดให้ frontend และ backend อยู่ด้วยกัน เพื่อ deploy เว็บแอปครั้งเดียว เช่นเดียวกับแนวทางที่ผู้ใช้ระบุสำหรับระบบ koomport

- ใช้ repository และโปรเจกต์เดียวสำหรับ frontend และ backend
- ให้กระบวนการ deploy เดียวเผยแพร่ทั้งหน้าเว็บและ API ของแอป
- ให้หน้าเว็บเรียก API ผ่าน same origin และ relative URL
- แยกไฟล์ component, route และ business logic ภายในโปรเจกต์เพื่อดูแลรักษาได้ง่าย
- แยก route และ layer สำหรับ API frontend กับ API admin/management อย่างชัดเจน
- เชื่อมต่อ Supabase จาก backend โดยเก็บรหัสผ่านฐานข้อมูลและ `DATABASE_URL` เฉพาะฝั่งเซิร์ฟเวอร์
- Supabase เป็นบริการฐานข้อมูลภายนอก ไม่ต้อง deploy ฐานข้อมูลใหม่พร้อมตัวแอป
- บน hosting ตั้งค่าความลับผ่าน environment secrets ตามเอกสาร `SUPABASE.md`

## สถานะการตัดสินใจ

ยืนยันข้อกำหนดการ deploy ร่วมกันแล้ว ยังไม่ได้เลือก framework หรือ hosting และยังไม่มีโค้ดระบบ koomport ให้ตรวจสอบ จึงยังไม่ได้ยืนยันรายละเอียดทางเทคนิคว่าเหมือนระบบนั้นทุกส่วน

## Decision override — 2026-10-11

คำสั่งผู้ใช้โดยตรงในแชตให้ frontend/backend deploy ครั้งเดียว มีลำดับเหนือกว่า topology สอง Vercel Projects ใน docs/00, 05, 12 และ D31 ใช้ repository `zoneidea/POS-Minimals` และโมดูล `apps/web`, `apps/api` ตามเดิม แต่ release เป้าหมายเป็น same-origin web/API ใน deployment เดียว รายละเอียด deployment config ยังไม่ implement ในงานพื้นฐาน API นี้

## Milestone 0: API foundation

- Implemented: health, client config, request IDs, safe errors, request/response metadata logs, user-scoped Supabase identity resolver, `/auth/me`, shared schemas, generated TypeScript OpenAPI types, CI checks.
- HTTP integration tests use an injected identity resolver. They are not live Supabase/RLS or staging evidence.
- No migrations applied; auth resolver needs the specified organization/membership schema and RLS before authenticated end-to-end use.
- Frontend, bootstrap, inventory, checkout, printing and reports remain pending.
- Local logs use JSONL files; Vercel uses stdout logs. Durable production retention/log tables remain pending.
- Native clients remain out of scope.

## Milestone 1: Identity/tenant backend

Implemented migration + RPC bootstrap + authenticated Express route + shared DTOs + DatabaseInitializer. 54 automated tests pass, including PostgreSQL RLS role/tenant cases and rollback/retry behavior. Remote Supabase remains untouched pending identification as development/staging vs production. PGlite is test-only, not the application database. Multi-connection bootstrap concurrency and hosted Supabase integration remain pending. React authentication UI and staff invitation management remain pending.

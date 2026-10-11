# การเชื่อมต่อ Supabase

## ข้อมูลโปรเจกต์

- Project URL: https://jibqgpfzmaqsjclbuaxn.supabase.co
- Project reference: `jibqgpfzmaqsjclbuaxn`
- Database host: `db.jibqgpfzmaqsjclbuaxn.supabase.co`
- Port: `5432`
- Database: `postgres`
- Database user: `postgres`

## ตัวแปรสภาพแวดล้อม

ค่าจริงบันทึกไว้ใน `.env.local` และตัวอย่างอยู่ใน `.env.example`

| ตัวแปร | การใช้งาน |
| --- | --- |
| `SUPABASE_URL` | URL สำหรับ Supabase client |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key สำหรับ Supabase client |
| `SUPABASE_DB_PASSWORD` | รหัสผ่านฐานข้อมูล ใช้เฉพาะฝั่งเซิร์ฟเวอร์ |
| `DATABASE_URL` | PostgreSQL direct connection สำหรับฝั่งเซิร์ฟเวอร์หรือ migrations |

รูปแบบการเชื่อมต่อ:

```text
postgresql://postgres:YOUR-PASSWORD@db.jibqgpfzmaqsjclbuaxn.supabase.co:5432/postgres?sslmode=require
```

## ข้อกำหนดในการพัฒนา

- โหลด `.env.local` ผ่านเครื่องมือของ framework ที่เลือก หรือ environment loader ฝั่งเซิร์ฟเวอร์
- ห้ามส่ง `DATABASE_URL` หรือรหัสผ่านฐานข้อมูลไปยัง browser หรือบันทึกลง logs
- ห้ามเพิ่ม prefix สำหรับตัวแปรสาธารณะให้กับรหัสผ่านหรือ `DATABASE_URL`
- กำหนด RLS และสิทธิ์เข้าถึงก่อนให้ frontend อ่านหรือเขียนข้อมูลผ่าน publishable key
- เก็บ `.env.local` นอก Git; บน hosting ให้ตั้งค่าผ่านระบบ environment secrets

## สถานะ

เชื่อมต่อและติดตั้ง identity migration แล้ว ดูผลตรวจสอบวันที่ 2026-10-12 ด้านล่าง

## การเชื่อมต่อที่ตรวจสอบแล้ว — 2026-10-12

โปรเจกต์นี้เป็นฐานพัฒนาตามการยืนยันของผู้ใช้

- ใช้ Session pooler: `aws-0-ap-southeast-2.pooler.supabase.com:5432`
- Username: `postgres.jibqgpfzmaqsjclbuaxn`
- Direct endpoint รองรับ IPv6 ซึ่งเครือข่ายเครื่องพัฒนานี้เข้าไม่ถึง
- CA certificate: `prod-ca-2021.crt` เป็น Supabase Root 2021 CA อายุถึง 2031-04-26
- ใช้ `sslmode=verify-full` และ `sslrootcert` ชี้ไปยังไฟล์ CA; ยังคงตรวจสอบ certificate และ hostname

```text
postgresql://postgres.jibqgpfzmaqsjclbuaxn:YOUR-PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=prod-ca-2021.crt
```

Migration `202610110001_identity_tenants.sql` ติดตั้งแล้ว ตรวจสอบว่าตาราง organizations, organization_members, store_settings, activity_logs เปิด RLS ครบ และ authenticated/anonymous ไม่มีสิทธิ์เขียนตารางโดยตรง ฟังก์ชัน bootstrap จำกัด EXECUTE ให้ authenticated และกำหนด search_path ว่าง จำนวนร้านหลัง migration = 0; ยังไม่ได้สร้างบัญชีหรือทดสอบ signup/checkout จริง

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

บันทึกข้อมูลการเชื่อมต่อแล้ว ยังไม่ได้ทดสอบการเชื่อมต่อ สร้างตาราง หรือเปลี่ยนแปลงฐานข้อมูล

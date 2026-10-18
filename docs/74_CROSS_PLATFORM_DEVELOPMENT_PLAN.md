# KidTang — แผนพัฒนา Client หลายแพลตฟอร์ม

วันที่ 2026-10-18 · ผู้ใช้เลือกเตรียมแผนรวมก่อน ยังไม่เลือกแพลตฟอร์ม/Framework

## เป้าหมายและขอบเขตรอบนี้

ให้ Windows, macOS, Android และ iOS ใช้ API/บัญชี/ร้าน/สิทธิ์/Module/ยอดขายเดียวกับเว็บ โดยคงการคำนวณและ transaction ที่ backend ปัจจุบัน รอบนี้เตรียม discovery API, OpenAPI และคู่มือเท่านั้น ไม่สร้าง Native App/SDK/Installer ไม่เปลี่ยนฐานข้อมูลหรือแจก credentials

อ่าน [คู่มือ API ปัจจุบัน](73_CROSS_PLATFORM_API_GUIDE.md) ก่อน เอกสาร 15–19 เป็นแนวคิดเก่า ไม่ใช่สัญญา implementation ราย endpoint รุ่นปัจจุบัน

## โครงสร้างความรับผิดชอบที่คงไว้

| ส่วน | ใช้ร่วมกัน | ทำเฉพาะ Client ภายหลัง |
|---|---|---|
| Identity/role/tenant | Supabase Auth + Express session authority/RLS | Login UI, secure token storage, deep-link handler |
| Catalog/stock/coupon | API/RPC เดิม | View models, barcode adapter, draft cart |
| Quote/checkout/void | Decimal calculation, locking, idempotency, audit ที่ server | Operation outbox, recovery UI, network state |
| Reports | API filtered aggregates/financial/Excel เดิม | Screen/chart renderer, downloads/share |
| Receipt/payment | Immutable receipt JSON, verified payment commit | OS printing, printer selection; Gateway integration ต้อง spike |
| Observability | Redacted server logs 30 วัน | Redacted local diagnostics/support bundle ตามขอบเขตที่อนุมัติ |

ไม่ย้าย business rules ไป Client ไม่ให้ service-role key ในแอป ไม่ใช้ Redis เป็นหลักฐานว่าสินค้าคงเหลือหรือจ่ายเงินแล้ว

## ลำดับงานและจุดตัดสินใจ

| ระยะ | งานส่งมอบ | ผ่านเมื่อ | สถานะ |
|---|---|---|---|
| P0 เตรียม API | Discovery แบบ opt-in, production base URL, typed contract, guide, raw HTTP compatibility tests | เว็บเดิมไม่เปลี่ยน response; native request ไม่มี Origin ยังต้อง auth; ไม่เปิดสิทธิ์จาก metadata | ดำเนินการในรอบนี้ |
| P1 เลือกเป้าหมาย | OS/ขั้นต่ำรุ่น/อุปกรณ์จริง/หน้าจอ/การพิมพ์/ช่องทางแจกจ่าย, framework evaluation | เลือกแพลตฟอร์มแรกและอนุมัติขอบเขต | รอการเลือก |
| P2 Integration spike | Login→session-policy→catalog, deep-link/reset, print sample, barcode input บนเครื่องจริง; Gateway feasibility แยก | เห็นข้อจำกัด hardware/provider พร้อมหลักฐาน ไม่ใช้ mock แทน UAT | ยังไม่เริ่ม |
| P3 Shared client adapter | API transport/errors/exact-decimal/secure storage/session handling/operation recovery, generated models เฉพาะ endpoint ที่ตรวจแล้ว | schema/compatibility/tenant/auth/retry tests ผ่าน; secrets audit | ยังไม่เริ่ม |
| P4 MVP POS | Login, cash POS, category/search/scan, cart persistence, checkout/recovery, receipt/reprint, sales วันนี้ | ทดสอบขายจริงร่วมเว็บไม่มี duplicate/oversell, physical printer UAT | ยังไม่เริ่ม |
| P5 Management/modules | Coupons, inventory/settings/staff ตาม roles และ Reports/financial; Gateway เมื่อ P2 ผ่าน | พนักงานไม่เห็น/เรียกสิทธิ์ owner, report totals/ledger ตรงเว็บ | ยังไม่เริ่ม |
| P6 Release | Signed installers/store package, update/rollback policy, release notes/support/runbook | จำกัดกลุ่มทดลองก่อน rollout; web/API backward compatibility, restore/recovery drill | ยังไม่เริ่ม |

ไม่มีประมาณวัน/งบแบบฟันธงก่อนเลือก OS, framework, hardware และ Gateway scope ให้ประเมินแต่ละระยะหลัง P1/P2

## ทางเลือกที่จะประเมินเมื่อ P1 (ยังไม่เลือก/ไม่ติดตั้ง)

| กลุ่ม | แนวทางประเมิน | หลักฐานที่ต้องได้ |
|---|---|---|
| Windows/macOS | Web-based desktop shell เทียบ Native desktop/Flutter/JavaFX ตามทีมและอุปกรณ์ | OS secure storage, signing/update, printer/barcode permissions, memory/startup on target hardware |
| Android/iOS | Cross-platform UI เทียบ Swift/Kotlin ตามความต้องการ hardware | deep links, secure storage/lifecycle, camera scanner, BLE/LAN printing restrictions, store distribution |
| Tablet POS | Responsive POS + touch/keypad + landscape | cart/list height, focus/scan speed, rotation/network recovery |

การเลือก React Native/Flutter/Electron/Tauri/JavaFX/Swift/Kotlin เป็นการตัดสินใจใน P1 ไม่ถือว่าอนุมัติโดยมีชื่อในตาราง ต้องตรวจเอกสารทางการรุ่นปัจจุบันและทำ spike ก่อนเลือก

## Acceptance matrix สำหรับ Client แรก

1. บัญชีเดียวกันอ่านร้าน/role/module เดียวกันกับเว็บ; สลับ user/org ไม่รั่ว draft หรือ receipt
2. Web+Client ขายสต็อกชิ้นสุดท้ายพร้อมกัน ต้องสำเร็จครั้งเดียว; ทดสอบหลาย connection บน staging ไม่ใช้ PGlite เป็นข้อพิสูจน์ concurrency
3. Timeout ก่อน/หลัง commit และปิดแอปแล้วเปิดใหม่ ใช้ key เดิม recover ไม่ขายซ้ำ; 404 recovery ไม่สรุปว่า request แรกล้มเหลว
4. ล็อกอินก่อนเที่ยงคืนไทย, app sleep/resume หลังเที่ยงคืน ต้อง login ใหม่; token refresh ไม่ขยาย daily session
5. ลดสิทธิ์/ระงับ/logout ที่เว็บ ต้องถูกบังคับตาม session authority ฝั่ง server ไม่ใช้ cache Client ให้ผ่าน action
6. Header platform/version ปลอมและ orgId ปลอมไม่เพิ่มสิทธิ์; OWNER/EMPLOYEE/ACCOUNTANT สองร้านผ่าน RBAC/RLS
7. ต้นทุน/ราคาแก้หลังขายไม่แก้ receipt หรือ COGS เก่า; ยอด VAT/ส่วนลด/คูปอง/รายงานตรงเว็บถึงสตางค์
8. ใช้คูปองสุดท้ายพร้อมกัน, void คืนสิทธิ์ครั้งเดียว, ร้านไม่มี module เรียกไม่ได้
9. ถอด printer/กระดาษหมด/คิวค้าง ไม่ checkout ซ้ำ; reprint snapshot เดิมพร้อมคำว่าสำเนา; ตรวจ 58/80mm/ภาษาไทยกับรุ่นอุปกรณ์จริง
10. หากเพิ่ม Gateway: pending/expired/paid-not-posted/void/recovery และหยุด polling เมื่อปิด UI; provider SDK/approval ต้องพร้อมก่อนเปิด
11. แอป/Installer/log ไม่มี token/password/PII/plaintext bank account/service key; support bundle redact และมีนโยบายเก็บรักษา
12. API optional-field compatibility, min-version policy ของ Client ที่เลือก, downgrade/release rollback ไม่ทำลาย ledger/outbox

## สิ่งที่ต้องเตรียมก่อนเริ่ม P2

- เลือกแพลตฟอร์มแรกและงานที่ต้องใช้ เช่น cash POS หรือรายงานก่อน
- OS/เครื่องจริงและ printer model/USB/LAN/Bluetooth; บาร์โค้ด USB keyboard หรือ camera
- Staging แยกข้อมูลจริง พร้อมร้าน A/B และ roles สำหรับทดสอบ
- Public Auth configuration ผ่าน build settings; secrets ของ backend อยู่ hosting เท่านั้น
- Bundle/application identifiers และ redirect URLs ที่เจาะจง; review ก่อนเพิ่ม allowlist
- ช่องทางแจกจ่าย/ลงนาม และผู้รับผิดชอบ credentials ฝั่ง signing (ไม่ใส่ไว้ใน repository)
- ยืนยัน Gateway อยู่ demo/disabled เช่นเดิม หรืออนุมัติ feasibility เพิ่มต่างหาก

## นอกขอบเขต

Offline paid checkout/sync, marketplace billing จริง/auto renewal, ค่าใช้จ่ายดำเนินงาน, second display และรับออเดอร์จากแพลตฟอร์มอื่น ไม่ถูกเริ่มจากแผนนี้ ไม่มีงานย้าย region หรือโครงสร้าง backend

## ย้อนกลับและการเข้ากันได้

ปิดการใช้ integration profile ใน Client ได้โดยไม่กระทบเว็บ Default `/client/config` คงค่าเดิม ไม่มี migration/การแก้ข้อมูล/การเพิกถอน session ในการเตรียมครั้งนี้ เมื่อสร้าง Native จริงให้ใช้ release ที่ระบุ contract/receipt revision และทดสอบเว็บเก่าร่วม Client ใหม่ทุกครั้งก่อน release

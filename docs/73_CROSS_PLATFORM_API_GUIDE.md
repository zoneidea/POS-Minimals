# POSJung — คู่มือ API สำหรับพัฒนา Client บนแพลตฟอร์มอื่น

วันที่เริ่มแผน: 2026-10-18 · อัปเดต 2026-10-27: ผู้ใช้เลือก React Native แล้ว ดู [React Native handoff](84_REACT_NATIVE_API.md) รอบนี้เตรียม API ยังไม่ได้สร้าง Native App หรือ SDK ใหม่

## 1. ขอบเขตและแหล่งอ้างอิง

ใช้ Express/Supabase และฐานข้อมูลเดียวกับเว็บ ไม่สร้าง backend แยกตามแพลตฟอร์ม ไม่ย้าย domain หรือเปลี่ยนการคำนวณเงิน/สต็อกเดิม เอกสารนี้เป็นแนวทางปัจจุบันสำหรับการเตรียม Client และมีลำดับเหนือข้อมูล draft เก่าในเอกสาร 15–19 สำหรับรายละเอียดที่ขัดกัน ยังไม่อนุมัติการเริ่มสร้างแอป/Installer/SDK หรือเลือก framework

- Production API: `https://posjung.com/api/v1`
- Local API: `http://127.0.0.1:8080/api/v1`
- Contract: [contracts/openapi.yaml](../contracts/openapi.yaml), models TypeScript: [generated.ts](../packages/contracts/src/generated.ts)
- ข้อมูลร้านและสิทธิ์ derive จาก session ฝั่ง server; ไม่รับ orgId เพื่อเลือกร้านจาก client
- ไม่มี API token แบบคงที่ประจำร้านสำหรับ Client ใช้ Supabase access JWT ของผู้ใช้งาน
- Public Supabase project URL/publishable key ต้องส่งผ่านการตั้งค่า build ของแอปในอนาคต ไม่ใช้ service-role/DB password/ReservePay key ใน Client

## 2. Discovery และความเข้ากันได้

`GET /client/config` คง response เดิมทั้งสามฟิลด์เพื่อรักษา Client เก่า:

```json
{"success":true,"data":{"apiVersion":"v1","minimumWebVersion":"1.0.0","receiptSchemaVersion":1}}
```

`GET /client/config?profile=integration` เพิ่ม `data.integration`:

```json
{
  "contractRevision": 1,
  "basePath": "/api/v1",
  "authProvider": "SUPABASE",
  "tokenHeader": "Authorization",
  "moneyEncoding": "decimal-string",
  "businessTimeZone": "Asia/Bangkok",
  "timestamps": "iso-8601",
  "pagination": "data",
  "identityPath": "/api/v1/auth/me",
  "sessionPolicyPath": "/api/v1/auth/session-policy",
  "logoutPath": "/api/v1/auth/logout",
  "checkoutRecoveryPath": "/api/v1/sales/by-idempotency-key/{key}",
  "offlineCheckout": false,
  "nativePaymentGatewayReady": false,
  "modulePurchaseMode": "DEMO"
}
```

Public metadata ไม่มี credentials/ข้อมูลร้าน/entitlements; ไม่ใช่ใบอนุญาตเข้าใช้ฟีเจอร์ สิทธิ์จริงต้องดู `/auth/me` และ `/marketplace/entitlements` ค่า minimumWebVersion ใช้กับเว็บเท่านั้น ยังไม่ประกาศขั้นต่ำของแอปที่ยังไม่สร้าง `profile` อื่นหรือ query ที่ไม่รู้จักตอบ 400

```bash
curl --fail 'https://posjung.com/api/v1/client/config?profile=integration'
```

## 3. Login และ session

1. เริ่มด้วย discovery; หาก API major ไม่รองรับให้หยุดการขายและแจ้งอัปเดต
2. Login ผ่าน Supabase Auth SDK ที่รองรับภาษา/แพลตฟอร์มที่เลือกในภายหลัง ไม่ส่ง password ไปยัง business API และไม่สร้าง endpoint login ซ้ำ
3. เก็บ access token ในหน่วยความจำ และ refresh token ใน OS secure storage; ไม่เก็บในไฟล์ plain text หรือ log
4. เรียก `/auth/me` และ `/auth/session-policy` ด้วย Bearer token; เก็บ expiry ที่ API ส่งมา ใช้นโยบายออกจากระบบเมื่อข้ามวันไทยเหมือนเว็บ
5. หน้าจออาจ reuse context เพื่อแสดงผล แต่ทุก protected request ยังถูกตรวจสิทธิ์ฝั่ง server ตาม session authority/RLS เดิม การเก็บ context ใน Client ไม่ได้ยกเลิกการตรวจฝั่ง server
6. Access token หมดอายุปกติให้ refresh แบบ single-flight ผ่าน Auth provider; อ่านข้อมูลซ้ำได้อย่างมีขอบเขต `SESSION_DAY_EXPIRED` ต้องออกจากระบบและ login ใหม่ ห้าม refresh เพื่อข้าม daily policy
7. Logout: เรียก `/auth/logout` เพื่อ revoke ฝั่ง KidTang แล้ว sign out ผ่าน Auth SDK และล้าง token; หากเครือข่ายล่มให้ล้าง local session และแจ้งว่ายังยืนยัน server revocation ไม่ได้
8. Signup/reset/invite บน Native ต้องกำหนด redirect allowlist และ deep-link handler ตามแพลตฟอร์มก่อน ยังไม่ได้ตั้งค่าหรือเปิด redirect ใหม่ในรอบนี้

Native HTTP ไม่จำเป็นต้องส่ง Origin; CORS ไม่ใช่ authentication และไม่ได้ห้าม Client ที่ไม่มี Origin เบราว์เซอร์ที่มี Origin ยังต้องอยู่ใน allowlist เดิม ไม่ส่ง Origin ปลอมเพื่อเลี่ยงข้อจำกัดของ WebView

## 4. HTTP conventions

| รายการ | กติกา |
|---|---|
| Authorization | `Bearer <access_token>` ทุก business request |
| X-Request-ID | UUID ต่อ HTTP attempt, API ส่งค่ากลับใน response header/error body ใช้ติดตามปัญหา |
| X-Client-Platform | Optional metadata: WEB/JAVAFX/ANDROID/IOS/OTHER ตาม enum เดิม; Windows/macOS ที่ยังไม่เลือก framework ใช้ OTHER ได้ ไม่ใช้ตัดสินสิทธิ์ |
| X-Client-Version | Optional version ของ Client ไม่ใช่ version ระบบหรือ API |
| Content-Type | application/json สำหรับ JSON; file upload ใช้ multipart ตาม route |
| Idempotency-Key | UUID ที่ Client เก็บถาวรก่อนส่ง checkout/adjust-stock และ route ที่ contract ระบุ; คง key และ payload เดิมเมื่อลองซ้ำ |
| เงิน | decimal string เช่น `"22.00"`; ใช้ exact decimal/minor-unit arithmetic ตามภาษา ไม่ใช้ float สำหรับสรุปเงิน |
| ตัวเลข version | `expectedVersion`/rowVersion เป็น integer ต้องรักษาความแม่นยำ; ห้ามปัดเศษ |
| เวลา | timestamp ISO-8601; date-only ตามวัน Asia/Bangkok; กฎเวลาใช้ server |
| แบ่งหน้า | `{items,total,page,limit}` อยู่ใน `data` ไม่ใช่ `meta`; limit แตกต่างตาม route (รายงาน 10, catalog 1–100) |
| Empty/error | แสดง UI เดิมครบ แล้วขึ้นไม่มีข้อมูล/ไม่สามารถโหลดข้อมูลได้; ไม่เดาข้อมูลเป็นยอดขายจริง |

Response JSON ปกติ: `{"success":true,"data":...}`; error: `{"success":false,"error":{"code":"...","message":"..."},"requestId":"UUID"}`. ไม่สมมติว่ามี `error.details` หรือ `meta` เสมอ ไฟล์ Excel เป็น binary ไม่ผ่าน JSON parser รูปสินค้าใช้ signed URL หมดอายุได้และห้ามเปิดเป็น public bucket เพื่อแก้ปัญหา Client

401 ต้องแยก access expiry จาก daily expiry/revocation; 403 หยุด action ที่ไม่มีสิทธิ์; 409 re-quote/ทบทวนรายการ; 400 แก้ input; 413 ลดขนาด payload; 503/backoff แบบมีขอบเขต ห้าม auto-retry mutation ทุกชนิดโดยไม่มี recovery policy

## 5. Endpoint ที่ใช้เริ่มพัฒนาได้จริง

ทุก path ต่อจาก base `/api/v1`; ตารางนี้เป็น integration subset ที่ตรวจจาก routes จริง ไม่ใช่การรับรองทุก draft path ใน OpenAPI

| งาน | Endpoint | เงื่อนไขหลัก |
|---|---|---|
| สถานะ/โปรโตคอล | GET `/health`, `/client/config?profile=integration` | public |
| ตัวตน/วันหมดอายุ | GET `/auth/me`, `/auth/session-policy`; POST `/auth/logout` | signed user |
| สมัครร้าน | POST `/orgs/bootstrap` | verified user ตาม bootstrap schema ปัจจุบัน; contact required |
| Catalog/บาร์โค้ด | GET `/products?barcode=...&page=1&limit=10` | OWNER/EMPLOYEE; search/categoryId ตาม schema |
| หมวดหมู่ | GET `/categories` | ใช้ role/grants ตาม canonical contract |
| คลังสินค้า | GET/POST `/inventory/products`; PATCH/DELETE `/inventory/products/{id}` | OWNER; soft delete/expectedVersion |
| ปรับ/ดูสต็อก | POST `/inventory/products/{id}/adjust-stock`; GET `/inventory/stock-movements` | delta จำนวนที่เพิ่ม/ลด, before/after/actor/time อยู่ใน log |
| Quote | POST `/sales/quote` | OWNER/EMPLOYEE; CASH flow; no reservation |
| Cash checkout/recovery | POST `/sales`; GET `/sales/by-idempotency-key/{key}` | OWNER/EMPLOYEE |
| รายการขายวันนี้/ใบเสร็จ | GET `/sales`; GET `/sales/{id}/receipt` | role restrictions ตาม route/RPC; accountant ดูบิลผ่าน report routes |
| ยกเลิกขาย | POST `/sales/{id}/void` | OWNER, วันไทยเดียวกัน; คืนสต็อก/คูปองผ่าน transaction |
| รายงาน/financial | GET `/reports/sales`, `/reports/cashiers`, `/reports/{type}/export.xlsx` | OWNER/ACCOUNTANT; date/cashier/page |
| Dashboard | GET `/dashboard/summary`, `/dashboard/product-rankings` | OWNER |
| โมดูล/คูปอง | GET `/marketplace/entitlements`; `/coupons`; `/reports/coupons` | module guard/RBAC เดิม; ซื้อเป็น demo |
| ร้าน/พนักงาน | `/settings/store`, `/users`, `/users/invitations` | ส่วนจัดการตามสิทธิ์จริง ห้ามใช้เป็นหน้า POS ของพนักงาน |

Draft paths `/settings/receipt-public`, `/payments/promptpay/config`, `/audit/products`, `/audit/products/{auditId}/reverse` ยังไม่มี mounted route ใน API ปัจจุบัน จึงใส่ `x-implementation-status: planned` ใน OpenAPI และห้ามผูก Client ให้พึ่งพา ใช้ receipt snapshot, payment config และ stock/activity history ที่ใช้งานจริงแทนหลังยืนยันสิทธิ์/flow ต้องทำ endpoint/DTO audit ครบ module ที่เลือกก่อนสร้าง SDK จริง ไม่สร้าง alias ตามเอกสาร draft

## 6. ตัวอย่าง cash checkout ที่ใช้ร่วมกัน

1. Catalog ให้ product `id`, `salePrice`, `rowVersion`, `quantityOnHand` (บาร์โค้ดเก็บเป็น string)
2. ส่ง quote ที่รวม coupon optional เมื่อร้านซื้อโมดูลแล้ว:

```json
{"items":[{"productId":"00000000-0000-4000-8000-000000000001","quantity":1}],"discountAmount":"0.00","paymentMethod":"CASH"}
```

3. แสดงยอดจาก quote; เมื่อลูกค้ายืนยัน สร้าง operation UUID และ persist **key + payload + user/org + state** ลง encrypted local outbox ก่อนส่ง ไม่มี token/password อยู่ใน outbox
4. POST `/sales` ด้วย `Idempotency-Key: <operation-UUID>` ตัวอย่างโครงสร้าง ต้องแทน IDs/prices/versions ด้วยข้อมูลจริงจาก quote:

```json
{
  "items":[{"productId":"00000000-0000-4000-8000-000000000001","quantity":1,"expectedUnitPrice":"22.00","expectedVersion":2}],
  "discountAmount":"0.00",
  "expectedTotalAmount":"22.00",
  "payment":{"method":"CASH","receivedAmount":"50.00"}
}
```

5. 201 = สร้างสำเร็จ, 200 อาจเป็น replay; แสดงบิล/receipt snapshot เดียวกัน แล้วพิมพ์ผ่าน Client print adapter แยกต่างหาก
6. Timeout/แอปปิดระหว่างส่ง: กลับมาใช้ recovery ด้วย key เดิม; found ให้ใช้ผลเดิม ห้ามขายซ้ำ หาก 404 **ยังไม่พิสูจน์ว่า request แรกจะไม่ commit**; ตรวจซ้ำแบบ bounded แล้วถ้าจะส่งซ้ำให้ใช้ key+payload เดิมเท่านั้น หากยอด/สินค้าเปลี่ยน ต้องจัดการ operation เดิมก่อนสร้างใหม่
7. Printer error/reprint ใช้ receipt เดิม ไม่เรียก checkout ซ้ำ ดูบิล/พิมพ์สำเนาภายหลังได้
8. 409 เรื่องราคา/สต็อก/คูปอง: re-quote และให้ผู้ใช้ยืนยันใหม่ ไม่แก้ payload ใต้ key เดิมที่อาจถูกผูกแล้ว

## 7. ข้อจำกัดที่ต้องเห็นก่อนเลือกแพลตฟอร์ม

- Gateway ปัจจุบันเริ่ม session ด้วย ReservePay browser SDK และใช้ backend verify/commit; ยังไม่มี Native SDK/hosted checkout bridge ที่รับรอง อย่าประกาศว่า QR native พร้อมใช้ หรือ mark paid จาก QR/Client อย่างเดียว ต้องศึกษา provider support เมื่อเลือกแพลตฟอร์ม
- Payment Gateway ยัง disabled ในการตั้งค่าร้านสำหรับ demo; entitlement ไม่เปิด provider โดยอัตโนมัติ
- Print Agent เป็น helper สำหรับเครื่อง Windows/macOS เดิม ไม่ใช่ backend ของ Native App; มือถือ/USB/Bluetooth/LAN printer ต้อง spike/จับคู่/ทดสอบต่างหาก ไม่มี universal driver guarantee
- Offline เก็บได้เฉพาะ draft; ไม่รับเงินจริง/ตัดสต็อก/ออกบิลสำเร็จขณะ offline ไม่มี sync endpoints หรือรับประกัน exactly-once printing
- Marketplace เป็น demo purchase ไม่มีเงินจริง/ต่ออายุ/หักอัตโนมัติ; ต้องเคารพ module guard ใน API ทุก Client
- Second display ผ่านการใช้งานบน Web/Agent แล้ว แต่ Native ต้องมี adapter และทดสอบแยก; ไม่มีงานเชื่อมรับออเดอร์จากแพลตฟอร์มภายนอก
- ยังไม่มี public device registration, push notifications, background-sync หรือ per-native-app minimum version enforcement
- Log request/response metadata และสำคัญใช้ระบบ server เดิม retention 30 วัน; Client log ต้อง redacted ไม่มี payload/PII/token สต็อก/ยอดขาย/คูปอง audit เป็น ledger ไม่ล้างตาม diagnostic retention

## 8. แหล่งอ้างอิง Auth ที่ตรวจแล้ว

ตรวจเอกสารทางการเมื่อ 2026-10-18: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions) และ [Native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking). Access/refresh session ของ Supabase และ deep links เป็นส่วน Auth provider; daily Bangkok expiry เป็นกฎของ KidTang ที่บังคับเพิ่มโดย API ไม่มีการคัดลอกตัวอย่าง OAuth/deep-link ที่มี token ไปใส่ log

## 9. ผลตรวจรอบเตรียม API

- Discovery แบบเดิมคง response เดิม; integration profile ผ่านการ validate ด้วย ClientConfig schema ใน OpenAPI ไม่มี credentials หรือข้อมูลร้าน
- HTTP tests ครอบคลุม native/no-Origin + Bearer, missing/invalid token, ตัวตนสองร้าน, query orgId ปลอม, CORS allowlist และ platform/version ปลอมไม่ยกระดับ employee เป็น accountant
- Focused regression 4 ไฟล์/12 tests ผ่าน รวม daily session, logout และ coupon HTTP; generated types, typecheck และ API/Web build ผ่าน
- ไม่มี migration หรือ Native executable; ไม่ได้อ้างว่าทดสอบ hardware/SDK/หลาย Client บนเครื่องจริงแล้ว

## React Native preparation - 2026-10-27

Opt-in `GET /client/config?profile=react-native` adds React Native-specific metadata, preserving both older responses. See [84_REACT_NATIVE_API.md](84_REACT_NATIVE_API.md) for Auth lifecycle, current routes, durable checkout recovery and native hardware boundaries. Framework selection supersedes the initial framework-neutral preparation scope above; no Native executable is shipped.

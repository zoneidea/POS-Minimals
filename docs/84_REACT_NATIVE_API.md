# POSJung — React Native API handoff

วันที่ 2026-10-27 · ผู้ใช้เลือก React Native และให้เตรียม API สำหรับแอป

## ขอบเขตและค่าที่ใช้เชื่อมต่อ

ใช้ API/บัญชี/ข้อมูลร้านเดียวกับ Web และ LINE ไม่สร้าง backend แยก ไม่เปลี่ยน region และไม่มี migration รอบนี้ เตรียม contract, discovery และคู่มือเท่านั้น ยังไม่ได้สร้างแอป React Native, ติดตั้ง Expo หรือรับรองการพิมพ์บน iOS/Android

- Production base URL: `https://posjung.com/api/v1`
- Public discovery: `GET /client/config?profile=react-native`
- OpenAPI: [`contracts/openapi.yaml`](../contracts/openapi.yaml) · TypeScript types: [`generated.ts`](../packages/contracts/src/generated.ts)
- Build configuration ของแอป: API base URL, Supabase project URL และ publishable key เท่านั้น ใช้ค่าจริงจากโปรเจกต์เดิม ไม่ใส่ service-role/secret key, database URL, ReservePay key, Resend key หรือ `SALE_SNAPSHOT_KEY` ในแอป
- Android/iOS ใช้ backend HTTPS จริงระหว่างพัฒนา; `127.0.0.1` บนโทรศัพท์หมายถึงโทรศัพท์เอง ไม่ใช่เครื่อง dev

Discovery คงสามฟิลด์เดิม และ `integration` เดิม เพิ่ม `reactNative` เฉพาะเมื่อเลือก profile นี้:

```json
{
  "framework": "react-native",
  "applicationReleased": false,
  "tokenStorage": "OS_SECURE_STORAGE",
  "sessionExpiry": "ASIA_BANGKOK_MIDNIGHT",
  "storeModes": ["RETAIL", "CAFE", "RESTAURANT"],
  "parkedBillsSync": false,
  "printing": "PLATFORM_ADAPTER_REQUIRED",
  "customerDisplay": "PLATFORM_ADAPTER_REQUIRED"
}
```

นี่คือข้อมูล integration ไม่ใช่สิทธิ์ใช้ร้านหรือหลักฐานว่าหน้าจอ/ฮาร์ดแวร์ Native ถูกพัฒนาแล้ว `minimumWebVersion` ยังใช้กับ Web เท่านั้น ค่า `offlineCheckout:false`, `nativePaymentGatewayReady:false`, `modulePurchaseMode:DEMO` ยังเหมือนเดิม Default `/client/config` และ profile `integration` ไม่เปลี่ยน response

## Auth และ session lifecycle

1. เริ่มด้วย discovery แล้ว Login ด้วย `supabase.auth.signInWithPassword({email,password})` ผ่าน Supabase JS ในแอป ไม่ส่ง password ไป business API และไม่เพิ่ม `/login` ซ้ำ
2. สร้าง Auth client แบบ singleton: `persistSession:true`, `autoRefreshToken:true`, `detectSessionInUrl:false` ใช้ URL polyfill/locking ตาม SDK เวอร์ชันที่เลือก เก็บ session ผ่าน adapter ที่ใช้ OS Keychain/Keystore หรือ encrypted storage ที่รองรับขนาด session จริง ไม่เก็บ refresh token ใน AsyncStorage แบบ plaintext
3. ผูก `AppState` กับ `startAutoRefresh()` เมื่อ active และ `stopAutoRefresh()` เมื่อ background พร้อมถอด listener เมื่อเลิกใช้งาน ห้ามสร้าง refresh loop หลายชุด
4. หลัง login เรียก `GET /auth/me` และ `GET /auth/session-policy` ด้วย access JWT ก่อนเข้าร้าน; expiry จาก server เป็นเวลาหมด session เมื่อข้ามวันไทย ตรวจใหม่เมื่อกลับ foreground ไม่ใช้เวลาเครื่องเป็นผู้ตัดสินสิทธิ์
5. `SESSION_DAY_EXPIRED` หรือ `SESSION_REVOKED` ต้องกลับหน้า login; ไม่ refresh เพื่อหลบ daily policy ห้าม replay mutation อัตโนมัติหลัง login
6. Logout เรียก `POST /auth/logout` แล้ว sign out Auth SDK และล้าง local credentials หาก offline ให้ล้าง local credentials แต่แจ้งว่ายังยืนยัน server revocation ไม่ได้ เก็บ pending operation แบบเข้ารหัสและแยก user/shop ไว้ตรวจผลหลัง login ผู้ใช้เดิม
7. Signup/forgot-password/invitation ใช้ Auth เดิม แต่ deep-link scheme, bundle IDs และ redirect allowlist ของ Native ต้องกำหนดและทดสอบเมื่อเริ่มแอป ยังไม่เพิ่ม wildcard redirect รอบนี้ ส่วน SSO ของ LINE เป็น flow ที่ส่งมอบสำหรับ browser ไม่ใช่ Native SSO โดยอัตโนมัติ

Business requests ใช้ `Authorization: Bearer <access_token>` Native fetch ไม่ต้องส่ง `Origin` ห้ามปลอม Origin เพื่อเลี่ยง policy; การไม่มี Origin ไม่ได้ให้สิทธิ์ใด ๆ Header `X-Client-Platform: ANDROID` หรือ `IOS`, `X-Client-Version` และ UUID `X-Request-ID` เป็น metadata ไม่ใช่การยืนยันสิทธิ์ คง CORS ของ Web/LINE เดิม

## API ที่ใช้กับแต่ละหน้าจอ

ทุก path ด้านล่างต่อจาก base URL ใช้ schema/parameters จาก OpenAPI ไม่ใช้ mock payload เป็น production contract และไม่ส่ง orgId เพื่อเลือกร้าน Server derive ร้านจากผู้ใช้ที่มีสมาชิก active

| หน้าจอ/งาน | Endpoint ที่ใช้อยู่ | เงื่อนไขสำคัญ |
|---|---|---|
| ตัวตน/สิทธิ์ | `GET /auth/me`, `/auth/session-policy` | ใช้ userId/orgId/role จาก server |
| สร้างร้าน | `POST /orgs/bootstrap` | ตาม bootstrap contract; ยังใช้ email-required เดิม |
| โหมดร้าน | `GET /settings/store-mode` | RETAIL/CAFE/RESTAURANT |
| รายการขายสินค้า | `GET /products?page=1&limit=20`, `GET /categories` | ใช้ `/products` สำหรับ catalog; ห้ามสลับเป็น inventory API ของ owner |
| ค้น/บาร์โค้ด | `GET /products?barcode=...` หรือ `search=...` | barcode เป็น string รวมเลขศูนย์นำหน้า |
| ตัวเลือกคาเฟ่ | `GET /cafe/options` | ส่ง lineId, optionIds, note ตอน quote/ขาย ตาม schema |
| ชำระเงินสด | `POST /sales/quote`, `POST /sales` | quote ไม่ใช่การจองสต็อก; sale ต้องมี Idempotency-Key |
| กู้คืนผลขาย | `GET /sales/by-idempotency-key/{key}` | ห้ามเริ่มคำขอใหม่เมื่อผลเดิมยังไม่ชัดเจน |
| รายการบิล/ใบเสร็จ | `GET /sales/bills`, `GET /sales/{id}/receipt` | Query/role ตาม contract; พิมพ์จาก immutable receipt |
| ยกเลิกขาย | `POST /sales/{id}/void` | OWNER และกฎเวลา/สถานะที่ server กำหนด |
| โต๊ะ/บิลร้านอาหาร | `GET /restaurant/board`, `POST /restaurant/tables/{id}/open` | OWNER/EMPLOYEE ในโหมดร้านอาหาร |
| สั่งอาหาร/ย้ายโต๊ะ | `POST /restaurant/bills/{id}/rounds`, `/move` | version และ key ใน body; ไม่สร้าง key ใหม่เมื่อ retry |
| คิดเงินโต๊ะ | `POST /restaurant/bills/{id}/quote`, `/checkout/cash`; `GET /restaurant/bills/{id}/settlement` | ใช้บิล server ไม่ส่งตะกร้าทับออเดอร์เดิม |
| ตั้งค่าโต๊ะ/โซน | `/management/restaurant/tables`, `/management/restaurant/zones` | OWNER ตาม method ที่ประกาศใน contract |
| สินค้า/สต็อก | `/inventory/products`, `/inventory/products/{id}/adjust-stock` | Management role และ version/idempotency ตาม contract |
| รายงาน | `/reports/sales`, `/reports/cashiers`, `/reports/{type}/export.xlsx` | OWNER/ACCOUNTANT; ดาวน์โหลด Excel แบบ binary |
| Dashboard | `/dashboard/summary`, `/dashboard/product-rankings` | OWNER |
| โมดูล/คูปอง | `/marketplace/entitlements`, `/coupons`, `/reports/coupons` | เช็ก entitlement และ role; การซื้อยังเป็น DEMO |
| ตั้งค่าร้าน/สมาชิก | `/settings/store`, `/users`, `/users/invitations` | OWNER ตาม method; ไม่ข้ามผ่าน UI guard อย่างเดียว |

Guest `/order/` เป็น capability ของบิลสำหรับลูกค้า ไม่ใช่ทางลัดให้ Native staff app เข้าร้านโดยไม่ Auth

## ตัวอย่างที่นำไปเชื่อมต่อ

ตัวอย่าง TypeScript นี้เป็นโค้ดในคู่มือ ไม่ใช่ SDK ที่ติดตั้งแล้ว `supabase` คือ singleton Auth client ที่แอปตั้งค่าด้วย secure storage ตามด้านบน:

```ts
import type {paths} from '@pos/contracts';
type IdentityResponse = paths['/auth/me']['get']['responses']['200']['content']['application/json'];

const API_BASE_URL = 'https://posjung.com/api/v1';
const {data: {session}, error} = await supabase.auth.getSession();
if (error || !session) throw new Error('Login required');
const response = await fetch(`${API_BASE_URL}/auth/me`, {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'X-Client-Platform': 'ANDROID', // IOS บน iOS
    'X-Client-Version': '0.1.0',
  },
});
const result: IdentityResponse = await response.json();
// ตรวจ response.ok / success และ validate runtime schema ก่อนใช้จริง
// อย่า log session, result ที่มีข้อมูลร้าน/ชื่อ หรือ Authorization
```

ตัวอย่าง request quote เงินสด ซึ่งยังไม่สร้างยอดขาย:

```json
{
  "items": [{"productId":"<UUID จาก catalog>","quantity":1}],
  "discountAmount":"0.00",
  "paymentMethod":"CASH"
}
```

คาเฟ่เพิ่ม `lineId` ที่คงเดิม, `optionIds` ที่เลือก และ `note` ตามรายการ ไม่รวมสองบรรทัดที่มีตัวเลือก/หมายเหตุต่างกัน ตอนส่งขายใช้ `unitPrice`, `expectedVersion`, `optionsFingerprint` จาก quote เพื่อประกอบ `expectedUnitPrice`, `expectedVersion`, `expectedOptionsFingerprint` ตาม checkout schema ห้ามส่ง quote ทั้งก้อนไป POST `/sales`

## Checkout และผลลัพธ์ไม่แน่นอน

1. ใช้เลขเงินแบบ decimal string เช่น `"65.00"`; คำนวณแสดงผลด้วย exact decimal/minor units ไม่ใช้ float รวมยอด Server เป็นผู้คำนวณยอดสุดท้าย
2. รับ quote ล่าสุด แล้วบันทึก immutable payload + UUID operation key + user/org + สถานะลง encrypted durable outbox ก่อนส่งขาย; UUID ต้องใช้ implementation ที่รองรับ runtime React Native จริง ไม่สมมติว่ามี browser crypto API
3. `POST /sales` ใส่ `Idempotency-Key` เดิม; ใส่ receivedAmount/expectedTotalAmount จาก flow ที่ผู้ใช้ยืนยัน ไม่สร้าง key ใหม่อัตโนมัติ
4. Timeout/app background/process ถูกปิด: กลับมาเช็ก recovery ด้วย key เดิม ผล 404 ยังไม่พิสูจน์ว่า request แรกจะไม่ commit หากส่งซ้ำต้อง key และ payload เดิมเท่านั้น
5. เปิด operation ใหม่เมื่อรายการเดิมได้ข้อสรุปแล้ว; ราคา/สต็อกเปลี่ยนให้ re-quote ตาม conflict policy ไม่แก้ body ภายใต้ key ที่อาจ commit แล้ว
6. พิมพ์หลังสำเร็จเท่านั้น พิมพ์ล้มเหลวใช้ receipt เดิม ไม่ checkout ซ้ำ โต๊ะใช้ recovery `/settlement` และคง key ใน body ของคำขอเดิม

Error envelope: `{success:false,error:{code,message},requestId}`. แยก 400 invalid input, 401 หมดสิทธิ์/session, 403 role, 409 stale/stock/duplicate conflict, 413 payload, 429 throttling และ 5xx/network unknown ห้ามครอบทุก POST ด้วย automatic retry การแสดง error คงหน้าจอ/ข้อมูลรอตรวจสอบไว้

## ข้อจำกัดและเงื่อนไขเริ่มพัฒนาแอป

- Web/LINE, cafe, restaurant, second screen, table move และ parked bills มีผล Pass แล้ว; ไม่เปิดงาน UAT เดิมซ้ำจากการเตรียม API นี้
- Gateway ของ Native ยังไม่รับรอง; ReservePay ปัจจุบันใช้ browser SDK และ Gateway ถูกปิดใน Demo แยก provider feasibility ก่อนพัฒนา Native payment
- Print Agent/จอที่ 2 ทำงานแล้วบน Web/เครื่องที่รองรับ แต่ Native ต้องมี adapter และทดสอบ iOS/Android/เครือข่าย/permission จริง การเตรียม API ไม่เปิด unauthenticated LAN access หรือผ่อน origin/pairing guards
- บิลพักของ Web อยู่ใน localStorage เครื่อง/ผู้ใช้เดิม ไม่มี API sync; Native ต้องทำ local draft ของตนเองและแยก user/org/device ไม่ย้ายหรืออ่าน Web localStorage โดยอัตโนมัติ
- ไม่มี offline paid checkout หรือ background sales sync; cached stock ไม่ใช่หลักฐานว่าขายได้
- Login เริ่มด้วย email/password เดิม Username/no-email ยังพักไว้ ไม่เปิดจากการเลือก React Native
- ขั้นเริ่มแอปค่อยเลือก Expo หรือ bare RN, Android/iOS ขั้นต่ำ, app identifiers, deep links, storage/printing adapters และเครื่องทดสอบ ไม่ตั้งค่า redirect หรือสร้าง installer รอบนี้

## หลักฐานและแหล่งอ้างอิง

HTTP tests ใน `tests/client-integration-http.test.ts` ตรวจ default/integration compatibility, RN metadata/schema/no-secret, no-Origin Bearer, session guard, tenant injection และ role enforcement. นี่เป็น backend integration tests ไม่ใช่ผลทดสอบ Auth/printing บนมือถือจริง

- [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [React Native security / unencrypted AsyncStorage](https://reactnative.dev/docs/security)
- [Supabase native deep links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Expo Supabase lifecycle](https://docs.expo.dev/guides/using-supabase/)

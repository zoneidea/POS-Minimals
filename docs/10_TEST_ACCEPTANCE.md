# 10 — Test Plan & Acceptance Checklist

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Approach
Automated unit + integration + Supabase RLS SQL tests + end-to-end tests + load/concurrency + manual UAT บน printer 80mm จริง. ทุก test seed สองร้านอย่างน้อย (Org A/Org B) และ role ทั้งสาม.

## 2. Critical functional test cases
| ID | Test | Expected |
|---|---|---|
| T01 | Register owner store/email ใหม่ | สร้าง unique ORGID + OWNER membership + settings ครบ |
| T02 | Register email ซ้ำ | Reject, ไม่เกิด orphan org |
| T03 | Username ซ้ำสองคน | อนุญาต, ยัง login ด้วย email แยกบัญชีได้ |
| T04 | EMPLOYEE เข้า dashboard/void/edit inventory API | 403 |
| T05 | ACCOUNTANT ดูรายงาน/export, พยายามขาย | report OK / checkout 403 |
| T06 | Org A เรียก API product/sale/report ของ Org B | 403 หรือ 404 ไม่รั่วข้อมูล |
| T07 | Switch Grid/List/หมวดหมู่/สแกนบาร์โค้ด | ได้สินค้าที่ตรง, Enter scanner เพิ่ม cart |
| T08 | Manual discount=0 และ discount>subtotal | 0 ผ่าน / เกินยอด reject |
| T09 | Cash shortcut 20+50+100 | received =170 และ change update ทันที |
| T10 | Cash received=99.99, total=100.00 | ปุ่ม disabled, API 422, ไม่เกิด sale/stock movement |
| T11 | Cash received=100.00, total=100.00 | ชำระผ่าน, ทอน 0 |
| T12 | PromptPay ไม่มี config | UI/checkout ไม่อนุญาต |
| T13 | PromptPay QR displayed without cashier confirmation | ต้องไม่บันทึก sale |
| T14 | PromptPay manual confirm | Sale recorded status manually confirmed, no claim bank verified |
| T15 | Refresh/route away/back during cart | Cart ยังอยู่ภายใน org+user เดิม |
| T16 | Product price changed after cart/PromptPay quote before checkout | 409 CART_STALE, ไม่ commit sale, ต้องแจ้งให้ตรวจสอบยอดโอน (ถ้ามี) |
| T17 | Create product barcode duplicate same org | 409; other org same barcode allowed |
| T18 | Barcode same as soft-deleted product in same org | 409 ตาม no-reuse policy |
| T19 | Numeric inputs add form | default 0, no NaN/negative accepted |
| T20 | Stock adjust below zero | reject; original stock unchanged |
| T21 | Low stock quantity 0, 5, 6 | 0=out, 5=low red, 6=normal |
| T22 | Import Excel correct 30 rows | all rows preview then commit once, duplicate re-run safe |
| T23 | Import row 17 has invalid cost/barcode | show row errors, no partial commit |
| T24 | Edit product name/cost/price after sale | sale report and old receipt retain old snapshot |
| T25 | VOID by OWNER at +23h59m | success, stock restored once, report marks void |
| T26 | VOID by OWNER at +24h01m | denied |
| T27 | VOID by EMPLOYEE or ACCOUNTANT | denied |
| T28 | VOID same sale twice concurrently | stock restored only once |
| T29 | Reverse last product change | restore prior fields, new audit record links old |
| T30 | Reverse stale audit after another edit | 409 VERSION_CONFLICT, no overwrite |
| T31 | Receipt after successful sale on 80mm printer | correct text totals, footer/VAT/store snapshot; print dialog triggered |
| T32 | Payment request timeout after server commit | status lookup/retry same key returns same sale, no duplicate |
| T33 | Soft delete product/category | hidden from active UI, historical sale unaffected |
| T34 | VAT toggle after sale | old bill/report retains original VAT snapshot |
| T35 | Light/Dark + mobile/tablet/desktop | no clipped controls, all async pages show loading/error |
| T36 | Export XLSX formula-like product name | does not execute Excel formula |

## 3. Concurrency tests
- 20 simultaneous checkout requests for stock 5 -> exactly 5 units sold (subject to qty and unique shoppers); no negative stock
- Same idempotency key concurrently 10 times -> exactly 1 sale/1 payment/one stock decrement
- Two carts items in reverse order [A,B] and [B,A] concurrent -> no deadlock after sorted lock strategy; monitor DB error metrics
- Checkout during adjust/void -> consistent stock with no lost update
- Many-org activity -> no cache leak (key must include org) and no request context bleed

## 4. Security tests
- Unauthorized token/malformed/expired JWT = 401
- Direct Supabase Data API attempts for forbidden tables deny by RLS / grants
- Cross-tenant Storage signed URL/upload forbidden
- Service/secret key absent from bundle, source and logs
- Password no plaintext storage/log; signup/login brute force controls
- IDOR on `productId`, `saleId`, `auditId`, `memberId`; every path scoped to org
- Injection/XSS and Excel formula injection inputs covered

## 5. Exit criteria for production
- All P0/P1 test cases pass; no open Critical/High vulnerabilities or cross-tenant leaks
- Manual UAT: at least 1 actual 80mm printer test, cashier steps tested with keyboard scanner
- All schema migrations tested, RLS policies allow/deny automated, backups/restore tested
- Performance acceptance with actual benchmark evidence (no speculative TPS claim)
- Rollback deployment and feature toggle documented
- User signs off owner/employee/accountant workflows and open decisions


## Phase 1 mandatory Web App + API acceptance (replaces native-client gate)
- [ ] Web signup/login, bootstrap and `GET /auth/me` resolve correct ORGID/roles for 2 test organizations.
- [ ] OWNER, EMPLOYEE and ACCOUNTANT routes enforce RBAC at API/DB, including direct forged HTTP requests.
- [ ] Web quote/checkout uses decimal-safe totals and stock locking; concurrent HTTP callers cannot oversell or duplicate sale.
- [ ] Retrying checkout after timeout with same idempotency key returns same sale, no second stock adjustment.
- [ ] Web receipt snapshot remains identical after product edits; Web 80mm printer UAT + reprint after failure.
- [ ] API works over HTTPS with valid JWT and does not treat CORS or `X-Client-Platform` as authorization.
- [ ] Staging and production do not contain service role keys in React build artifacts or public logs.
- [ ] OpenAPI schema/TypeScript SDK tests, 2-org RLS, load/lock tests, responsive Light/Dark browser E2E pass.

**Deferred (not required for Phase 1 sign-off):** JavaFX/Java HTTP adapter build, Android/iOS SDK and screen tests, native installation, native OS printer integration, cross-client GUI parity. See `19_CROSS_CLIENT_TEST_PLAN.md` for later phases.

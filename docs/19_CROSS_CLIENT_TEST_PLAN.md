# 19 — Future Client Compatibility Test Plan (DEFERRED)

> Update 2026-10-18: ผู้ใช้อนุมัติเตรียม API และแผนรวมเท่านั้น ยังไม่เลือก/เริ่ม Native Client. ใช้ [73: คู่มือ API ที่ตรวจจาก implementation](73_CROSS_PLATFORM_API_GUIDE.md) และ [74: แผนรวม](74_CROSS_PLATFORM_DEVELOPMENT_PLAN.md) แทน draft เรื่อง endpoint, pagination, cash/Gateway flow, daily session และนโยบาย authorization cache ที่ต่างจากระบบปัจจุบัน.


> **Phase 1 scope:** React Web App + Node.js/Express API + Supabase only, using `https://github.com/zoneidea/POS-Minimals.git`. **Nothing in this file is required for Phase 1 exit criteria.** The required Phase 1 acceptance checklist lives in `10_TEST_ACCEPTANCE.md`.

## Why this document is retained
The API is designed to stay framework-neutral so that, after a later approval, JavaFX Desktop and/or Android/iOS Native clients can consume `/api/v1` without duplicating Backend business logic. This is a **future compatibility plan**, not a task list for the current development sprint.

## Future prerequisites
- Approve which client platform to build and its separate timeline/budget.
- Publish a stable production HTTPS API origin and OpenAPI contract.
- Decide native session storage and printer integration per supported OS/hardware.
- Prepare 2 organizations and OWNER/EMPLOYEE/ACCOUNTANT accounts in test environments.

## Future compatibility cases (do not run as Phase 1 gate)
| ID | Scenario | Expected |
|---|---|---|
| FC-01 | Web/Java/native `/auth/me` | Same org/role data from identical verified user |
| FC-02 | Non-browser HTTPS without Origin | JWT + membership remain mandatory; no CORS-as-auth |
| FC-03 | API quote money fields | Same decimal strings independent of client language |
| FC-04 | Concurrent Web and JavaFX sale on 1 item | Exactly one success, no overselling |
| FC-05 | Same `Idempotency-Key` replay after timeout | Exactly one committed sale |
| FC-06 | Historical receipt across renderer changes | Same immutable snapshot, totals and VAT |
| FC-07 | Native printer unplugged | Retriable print without duplicate sale |
| FC-08 | Cross-org forgery or spoofed `X-Client-Platform` | No authorization or tenant escalation |
| FC-09 | Secrets audit of app build | No Supabase secret/service-role key or DB password |

## Phase 1 equivalent coverage
Use TypeScript/OpenAPI schema validation, raw HTTP contract tests (without needing a Java SDK), browser E2E, RLS tests, concurrency/idempotency tests and actual Web 80mm printing per `10_TEST_ACCEPTANCE.md`. Native SDK generation, JavaFX installer builds, Android/iOS tests and Java GUI printer UAT are explicitly excluded now.

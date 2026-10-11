# 14 — Requirements-to-Implementation Traceability

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

ใช้ตารางนี้ตรวจว่าแต่ละ requirement มีเจ้าของ module, source data, API และการทดสอบก่อนปิดงาน

| Requirement group | Frontend module | Backend module/API | Main DB tables | Acceptance reference | Week |
|---|---|---|---|---|---|
| Register, unique email, ORGID | `auth` | `auth`, `/orgs/bootstrap` | `auth.users`, `organizations`, `organization_members` | T01–T03 | W1 |
| Role access, login org resolution | `auth`, `app` | `auth` middleware, `/auth/me` | `organization_members` | T04–T06 | W1 |
| Invite EMPLOYEE/ACCOUNTANT | `users` | `users`, `/users/*` | `organization_members`, `invitations` | Role matrix + cross-tenant | W1/W5 |
| POS list/grid, search, scan, category shortcuts | `pos` | `/products`, `/categories` | `products`, `categories` | T07 | W2/W3 |
| Cart persists on route/reload | `pos`, local store | None (server validates on checkout) | None | T15–T16 | W2/W3 |
| Discount, numpad, change, cash threshold | `pos` | `/sales/quote`, `/sales` | `sales`, `payments`, `sale_items` | T08–T11 | W3 |
| PromptPay + manual confirmation | `pos` | `/sales/quote`, `/sales` | `store_settings`, `payments` | T12–T14, T16 | W3 |
| Atomic checkout, race prevention | `pos` | `/sales`, DB `checkout_sale` | `products`, `sales`, `sale_items`, `payments`, `stock_movements` | T10/T16/T32 + concurrency | W3 |
| 80mm receipt, auto print dialog | `pos/receipt` | `/sales/:id/receipt` | `sales`, `sale_items`, `payments` | T31 | W4 |
| Product CRUD, barcode unique, images | `inventory` | `/inventory/products`, image upload | `products`, Storage | T17–T19, T33 | W2/W4 |
| Stock adjustment, low stock badges | `inventory`, `pos` | `/adjust-stock` | `products`, `stock_movements`, `product_audit_logs` | T20–T21 | W2/W4 |
| Product before/after audit and reverse | `audit`, `inventory` | `/audit/products/*` | `product_audit_logs`, `products`, `stock_movements` | T29–T30 | W4/W5 |
| Excel import and download template | `inventory` | `/inventory/import/*` | `products`, `categories`, `stock_movements` | T22–T23 | W5 |
| Category settings | `categories` | `/categories/*` | `categories`, `products` | T33 + role tests | W2/W4 |
| Shop settings / VAT / receipt footer | `settings` | `/settings/store` | `store_settings`, `sales` snapshots | T31/T34 | W4 |
| Cancel sale OWNER <=24h / restore stock | `pos`, `audit` | `/sales/:id/void`, DB `void_sale` | `sales`, `products`, `stock_movements` | T25–T28 | W4 |
| Historic sales report per employee | `reports` | `/reports/sales` | `sales`, `sale_items`, `payments` | T24/T34 | W6 |
| Inventory, low stock, cost valuation | `reports` | `/reports/inventory`, `/low-stock`, `/stock-valuation` | `products`, `categories` | T21 + export tests | W6 |
| Report Excel export | `reports` | `/reports/:type/export.xlsx` | Report SQL | T36 + RBAC test | W6 |
| OWNER dashboard | `dashboard` | `/dashboard/summary` | Aggregated sales/products | T04 + role test | W6 |
| Responsive, loading, Light/Dark | `app`, all modules | All API error contracts | N/A | T35 | Continuous |
| Tenant isolation, soft deletion | All modules | Middleware, RLS, Storage policies | All tenant tables | T06/T33 + SQL tests | Continuous |
| Node Cache + stateless scalability | `shared/api` | Cache adapter, Vercel API | None authoritative | Concurrency/load/cold-start | W6/W7 |

## Review checkpoints
- [ ] Every requirement has a corresponding ticket and API/DB/FE owner
- [ ] Every requirement has at least one automated test, manual UAT test or both
- [ ] No role receives a menu or API capability beyond `03_ROLES_PERMISSIONS.md`
- [ ] Historic snapshots, idempotency, org isolation and 24-hour void are tested before release
- [ ] Printer behavior and PromptPay manual confirmation are demonstrated to PO


## Phase 1 API-first traceability
| Requirement | Module/API | Implementation now | Test gate now |
|---|---|---|---|
| FR-API-01/02 | Express `/api/v1`, OpenAPI | Web TypeScript client and stable JSON DTOs | OpenAPI validation and Web contract tests |
| FR-API-03/04 | Auth middleware, RLS, `/auth/me` | React Browser + Express | JWT, role, org, HTTP without `Origin`, Web CORS |
| FR-API-05 | `/sales`, idempotency DB and lookup | React Web + API | HTTP concurrency and timeout recovery |
| FR-API-06 | `/sales/:id/receipt` | Browser/Kiosk 80mm print | Immutable receipt snapshot and print after commit |
| FR-API-07/08 | Import/export/upload/versioning | Web import/upload/export | xlsx, schema, error and version compatibility |

**Deferred for future versions:** JavaFX SDK/installer/UI, Java HTTP integration, Android/iOS app and native printer adapters. They are NOT acceptance gates for the above milestones.

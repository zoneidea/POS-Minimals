# 18 — Existing Web vs JavaFX API Migration Map

> Update 2026-10-18: ผู้ใช้อนุมัติเตรียม API และแผนรวมเท่านั้น ยังไม่เลือก/เริ่ม Native Client. ใช้ [73: คู่มือ API ที่ตรวจจาก implementation](73_CROSS_PLATFORM_API_GUIDE.md) และ [74: แผนรวม](74_CROSS_PLATFORM_DEVELOPMENT_PLAN.md) แทน draft เรื่อง endpoint, pagination, cash/Gateway flow, daily session และนโยบาย authorization cache ที่ต่างจากระบบปัจจุบัน.


> **Scope status: REFERENCE / FUTURE PHASE ONLY.** React Web App and Express API are the sole Phase 1 deliverables. Native client implementation, SDK generation, installer, device printing and cross-client CI are not authorized by this document.

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

**Decision**: Use a **single canonical API** defined by `07_API_CONTRACT.md` + `contracts/openapi.yaml`. The JavaFX documentation created previously contains alternate route names. When a future JavaFX phase is approved, align its HTTP adapter or generated SDK with the canonical paths listed here. Do not create automatic aliases for outdated paths unless existing deployed clients require a documented migration window.

| Feature | Legacy Web draft | Legacy JavaFX draft | Canonical shared v1 |
|---|---|---|---|
| Register/store | `POST /auth/register-store` public | `POST /orgs/bootstrap` JWT | `POST /orgs/bootstrap` JWT after Supabase Auth signUp |
| Current user | `GET /auth/me` | `GET /me` | `GET /auth/me` |
| POS products | `GET /products` | `GET /products` | `GET /products` |
| Inventory list | `GET /inventory/products` | `GET /inventory` | `GET /inventory/products` |
| Product create/edit | `/inventory/products` | `/products` | `/inventory/products` |
| Product image | `/inventory/products/:id/image` | `/products/:id/image` | `/inventory/products/:id/image` |
| Stock adjustment | `/inventory/products/:id/adjust-stock` | `/inventory/:productId/adjust` | `/inventory/products/:id/adjust-stock` (`delta`, not `qtyDelta`) |
| XLSX template | `GET /inventory/import/template` | same | same |
| XLSX preview | `POST /inventory/import/preview` | same | same; response includes `batchId` |
| XLSX commit | `POST /inventory/import/commit` | `POST /inventory/import/:batchId/commit` | `POST /inventory/import/:batchId/commit` |
| POS quote | `POST /sales/quote` | same | same |
| Checkout | `POST /sales` | same | same; full response in `data` envelope |
| Receipt | `GET /sales/:id/receipt` | same | same; immutable JSON not HTML binary |
| Void | `POST /sales/:id/void` | same | same |
| Safe receipt settings | none | `GET /settings/receipt-public` | `GET /settings/receipt-public` |
| Reports / dashboard | same | same | same |
| Product audit | same | same | same |

## DTO differences to fix in JavaFX client
- Stock adjust request field `delta`, **not** `qtyDelta`.
- Standard success envelope `{"success":true,"data":{...},"meta":{}}`; Java-only drafts with flat responses must unwrap `data`.
- Standard error envelope includes top-level `success:false,error:{code,message,details},requestId`. Java-only draft variants containing `error.requestId` must be updated.
- All prices/amounts use decimal strings, not doubles. Pagination fields are in `meta` (not independent Java-shaped `PageResponse`).
- Backend receives `expectedUnitPrice` string, `expectedVersion` int for checkout conflict safety; URL never selects org.
- Report export path binary `.xlsx` exception; client download method must not parse as JSON.
- JavaFX generated models should use wire name `id`/`saleId` and camelCase, not database snake_case.

## Migration order
1. Change JavaFX API base and paths using this map.
2. Regenerate Java SDK or update interface adapter against shared OpenAPI.
3. Run cross-client contract suite and 2-org permission tests.
4. Align JavaFX project's own outdated `07_API_CONTRACT.md` separately before implementing production code; this Web API bundle is authoritative for shared backend.

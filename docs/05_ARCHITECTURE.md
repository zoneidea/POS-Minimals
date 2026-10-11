# 05 — Solution Architecture

> **Implementation scope (Phase 1, 2026-10-11):** พัฒนาเฉพาะ **React Web App + Node.js/Express API + Supabase** ใน Repository [`zoneidea/POS-Minimals`](https://github.com/zoneidea/POS-Minimals). JavaFX Desktop และ Native Mobile App **ยังไม่ต้องพัฒนา ไม่ต้องสร้าง SDK/Installer หรือเพิ่มเป็น Gate ใน CI/UAT รอบนี้**; ออกแบบ API ให้ขยายในอนาคตได้เท่านั้น.

## 1. Deployment topology (Phase 1: Web App only)
```text
GitHub: https://github.com/zoneidea/POS-Minimals.git  [ONE REPOSITORY]
       |                                |
       v                                v
Vercel Project: pos-web           Vercel Project: pos-api
Root: apps/web                    Root: apps/api
React SPA + Tailwind              Node.js/Express (stateless Function)
       |                                |
       +----- HTTPS /api/v1 + JWT ----->|
                                        v
                           Supabase Auth / PostgreSQL / Storage
                                RLS + atomic transaction RPC
```

- **เพียง 1 GitHub repository, 1 Express codebase, 1 Supabase production project**. Vercel 2 Projects ใช้ repo เดียวกันโดยกำหนด Root Directory ต่างกัน ไม่ใช่การสร้าง 3 Express Projects หรือบริหาร 3 Node instances เอง.
- Vercel จะบริหาร Function instances/scale ให้เอง; backend ห้ามอาศัย process-local session/cart/stock/cache สำหรับ correctness.
- JavaFX GUI และ Android/iOS App **ไม่ deploy ไม่ build ไม่ test ใน Phase 1**; `/api/v1` เก็บรูปแบบ API-first ไว้เพื่อรองรับในอนาคต.
- Region ของ Vercel Function ควรอยู่ใกล้ Supabase DB; สำหรับเป้าหมายเริ่มต้นไม่เกิน 50 ร้าน ควร load test ก่อนเพิ่ม compute/infra.

## 2. Data request boundaries
- Browser ส่งคำขอข้อมูลธุรกิจ **ผ่าน Express API เท่านั้น**; อนุญาต Supabase Auth client สำหรับ login/refresh session
- API validate JWT signature/expiry และโหลด active org/role จาก DB (server-side)
- Queries ผ่าน user-scoped Supabase client ที่ส่ง user JWT เพื่อให้ RLS ทำงาน; restricted SECURITY DEFINER RPC สำหรับ transaction สำคัญ
- หากจำเป็นต้องใช้ Supabase secret key สำหรับ invite/bootstrap ให้ใช้ isolated backend-only admin client และเขียน explicit authorization ก่อนทำงาน; key นี้ bypass RLS ห้ามใช้แทน user context สำหรับงานทั่วไป
- PostgreSQL RPC `checkout_sale`, `void_sale`, `adjust_stock`, `reverse_product_change` ดูแล atomicity + row locks + recheck rights inside DB

## 3. Monorepo layout (suggested)
```text
POS-Minimals/           # git clone https://github.com/zoneidea/POS-Minimals.git
  apps/
    web/
      src/
        app/                 # router, providers, theme
        modules/
          auth/ pos/ inventory/ categories/ settings/
          users/ reports/ dashboard/ audit/
        shared/              # ui, api-client, hooks, utils, types
      public/
    api/
      src/
        app.ts               # export Express app for Vercel
        config/
        middleware/          # authenticate, tenant, authorize, validate
        modules/
          auth/ pos/ products/ categories/ inventory/
          settings/ users/ reports/ dashboard/ audit/
          # each: routes.ts, controller.ts, service.ts, repository.ts, schema.ts
        infra/
          supabase/ cache/ logging/ errors/
        tests/
  packages/
    contracts/               # generated OpenAPI TypeScript contracts + runtime Zod schemas
  contracts/
    openapi.yaml             # single source for cross-language HTTP API contracts
  # clients/                # NOT CREATED in Phase 1; reserve for future native applications
  supabase/
    migrations/
    tests/                    # tenant/RLS tests
    seed.sql
  docs/                       # this doc bundle
  .github/workflows/
  AGENTS.md
  DEVELOPMENT_WORKFLOW.md
```

## 4. Separation of concerns
- `routes`: routing and policy declaration
- `controller`: translate HTTP to use cases
- `service`: transaction orchestration/business rules
- `repository`: scoped reads and DB RPC calls
- `schema`: Zod request/response validation
- `infra`: Supabase admin/user clients, logging, cache adapter; no business-specific globals
- FE: `pages/components/hooks/api/types` inside each feature module; shared UI primitives only

## 5. State strategy
- Auth source: Supabase Auth; optional client session restore; authorization resolved by backend
- Cart: localStorage scoped to user + org; never in Node memory; server recomputes price/stock
- Order/payment/stock: PostgreSQL authoritative transactional state
- TanStack Query: frontend server-state cache only; invalidate relevant queries after edits
- Node LRU: process-local best effort read cache for noncritical settings/categories; no auth/stock/cart/order/payment

## 6. Print integration
- API returns canonical receipt snapshot JSON after committed sale and via `GET /sales/:id/receipt`; never sends raw USB print command from Vercel
- **Phase 1 Web**: browser print dialog or explicitly configured Chrome `--kiosk-printing` desktop; Kiosk is deployment choice, not remotely enabled by web JS
- **Later phase only** JavaFX: OS printer through Java Print Service/JavaFX PrinterJob; optional ESC/POS adapter
- **Later phase only** Android/iOS: OS print/AirPrint or optional local Print Hub; web-only silent-print guarantee is impossible
- Print retry must not retry checkout; receipt can be re-fetched/re-rendered/reprinted by sale id. Printer status does not equal sale status.

## 7. Feature flags / extensibility
- `ENABLE_PROMPTPAY_QR`, `ENABLE_SILENT_PRINT_BRIDGE` (default false), `ENABLE_PRODUCT_REVERSE`
- `POST /sales/quote` prepares current amount/PromptPay QR; final checkout revalidates quote amount and item prices within the transaction
- Frontend payment interface allows future gateway without changing historical data model
- Keep `org_id` on all tenant rows from day one. No need multi-branch `store_id` in MVP

## 8. Performance-sensitive points
- Keep Vercel Function region close to Supabase DB region; avoid unnecessary cross-region round trips
- Bound pool/concurrent DB queries; prefer a single transaction RPC for checkout; client pagination
- For non-RPC SQL direct connections on serverless use supported transaction pooler as recommended by Supabase; avoid mixing pooled/session settings carelessly
- Monitor API p95/error rate, Supabase DB connections, slow queries, locks, function cold starts

## 9. Architecture risks
- Browser silent printing is not guaranteed; use print dialog or local bridge
- Vercel Function memory cache can disappear anytime; every request works cold
- Supabase Auth signup and org provisioning span systems; implement idempotent onboarding and recovery of orphaned bootstrap records
- Cross-tenant leaks: org matching from token membership on every API, restrictive RLS and automated 2-org tests

References: https://vercel.com/docs/frameworks/backend/express , https://vercel.com/docs/functions , https://supabase.com/docs/guides/database/postgres/row-level-security .


## 10. API-first boundaries for all clients
1. Supabase Auth can be called directly by official/public Auth SDK or its public REST API (publishable key only). All **business** calls go through Express HTTPS `/api/v1`.
2. `openapi.yaml` is the canonical wire contract; Phase 1 TypeScript Web Client MUST validate/generate models from it; future native clients may reuse this contract but are not implemented now.
3. Web CORS allowlist from exact HTTPS origins and localhost dev origins; JavaFX/native mobile do **not** need CORS headers and cannot be authorized by origin.
4. Standard headers: `Authorization: Bearer <JWT>`, `X-Request-ID`, `X-Client-Platform`, `X-Client-Version`, `Idempotency-Key` for checkout/void/stock adjustments/import commit where specified. Platform header is analytics only.
5. Backend always infers org and role from verified token + DB; reject active membership missing. DTOs do not trust `orgId`, `price`, `discount` or printer state as authoritative business facts.
6. Client rendering and device interaction stay in clients. Server must not conditionally change business rules based on web/java/mobile User-Agent or header.
7. Upload uses backend-issued authorized short-lived signed URLs (tenant-scoped object prefix) or backend multipart endpoint; export uses bounded, authenticated HTTP response.
8. If backend moves from Vercel Functions to a continuously running cluster, no client endpoint changes; keep stateless API, short TTL metadata cache, DB transaction authority.

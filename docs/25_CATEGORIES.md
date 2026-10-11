# Categories — 2026-10-12

Implemented owner management at `/categories`: DataTable (10 rows per page), create/edit Modal, delete confirmation Modal, empty/loading/error/retry states, consistent labeled Lucide icons. EMPLOYEE can read catalog categories through API; ACCOUNTANT cannot. Every request resolves verified active membership; user-provided organization IDs are rejected.

## API contract

- GET `/api/v1/categories?page=1&limit=10`: OWNER/EMPLOYEE; `{success:true,data:{items:[{id,name,sortOrder}],total,page,limit}}`. Page 1..100000; limit 1..100.
- POST `/api/v1/categories`: OWNER; `{name}`; category response.
- PATCH `/api/v1/categories/:id`: OWNER; `{name}`; category response.
- DELETE `/api/v1/categories/:id`: OWNER; no payload; deleted category response.
- All use Bearer JWT. Errors use the existing safe envelope. 400 invalid payload/ID/query; 401 unauthenticated; 403 forbidden; 404 unknown/cross-store category; 409 duplicate name or category in use; 503 provider unavailable.

Canonical OpenAPI and generated TypeScript models updated. Web mutations use supported Supabase session token and relative Express URLs. No automatic write retries.

## Database and audit

Migration `202610120001_categories.sql` creates indexed tenant categories with active unique `(org_id,lower(trim(name)))`, RLS reads limited to OWNER/EMPLOYEE, and no direct authenticated writes. Narrow `manage_category` RPC derives caller organization and checks active OWNER again, locks an existing category, validates fields and atomically writes activity_logs. DELETE retains deleted_at/deleted_by; names can be reused after soft deletion. No category name or token is logged in request metadata.

Applied to the confirmed development Supabase on 2026-10-12 after local tests. Hosted browser GET returned the actual empty catalog. No test categories were inserted into the user's store by the agent.

Product module is not installed yet; product counts are not displayed. Delete checks actual active references if public.products exists. The next product migration must provide the specified org_id/category_id/deleted_at columns, composite FK and validation/locking that prevents attaching products to deleted categories. Concurrent product insertion vs deletion remains a future product integration test, not a claim made by this slice.

## Evidence

86 automated tests pass: route roles/input/pagination, 2-tenant RLS, owner-only RPC, duplicate names, cross-store guessed IDs, direct-write denial, soft delete/history and active-product guard using an isolated product fixture. TypeScript and production build pass. Browser verified actual hosted list, open/cancel form and 390px mobile without horizontal overflow. Hosted create/edit/delete awaits user UAT.

User confirmed the preceding session-expiry/login recovery slice passed UAT. Native clients, product CRUD and financial flows remain pending.

## UI update — 2026-10-12

Shared native-dialog Modal traps keyboard focus, labels its title, restores focus to the triggering control, supports Escape and blocks closing while a mutation is pending. Create/edit and delete errors remain inside their Modal for retry; cancel never sends a mutation. Delete confirmation initially focuses Cancel. Successful deletion refreshes the list and returns to the previous page when deleting its only row. DELETE remains exclusively soft delete through the existing owner-scoped RPC; no schema or authorization change. Current TypeScript checks, 92 tests (including pagination and soft-delete/RLS coverage), and production build pass. Updated Modal interactions await Local user review.

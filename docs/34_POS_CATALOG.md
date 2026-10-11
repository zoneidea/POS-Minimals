# POS catalog — first sales-page slice

Implemented `/pos` with real shop products, literal case-insensitive name/barcode search, exact barcode input (Enter submits; leading zeros retained), reload, empty/error/retry/loading states and ten-row DataTable pagination. Search submission resets the page. Existing icon sidebar, light/dark styles and responsive stacked search fields apply. Requests abort on leaving the page. Cart, category selector, images and checkout remain pending; no sales or stock changes occur on this page.

## API contract

`GET /api/v1/products?search=&barcode=&categoryId=&page=1&limit=10` requires Bearer JWT and active OWNER/EMPLOYEE membership. ACCOUNTANT is denied. Unknown parameters including `orgId` are rejected. Search max 200 characters, barcode 1–100, category UUID, page 1–100000, limit 1–100. Supplied filters combine with AND; barcode is exact, search uses literal substring, not SQL wildcard matching.

Response: `{success:true,data:{items:[{id,name,barcode,categoryId,salePrice,quantityOnHand,rowVersion,imageUrl:null}],total,page,limit}}`. Price is a decimal string with two fractional digits. Inventory costs, audit fields, deleted products and other tenants are excluded. Canonical OpenAPI and generated frontend types are updated. Request/response metadata uses existing safe API logging.

## Database and security

Migration `202610120004_pos_catalog.sql` adds only the restricted read RPC `list_pos_products`. It derives the organization from `auth.uid()` plus active membership/organization, never a caller-provided tenant. Its security-definer projection explicitly selects public catalog fields because the cost-bearing products table remains OWNER-only under existing RLS. PUBLIC/anon cannot execute the RPC; employees still cannot directly read full inventory rows. Existing indexes cover tenant/name ordering and category filtering. Substring search currently scans matching tenant rows; no unmeasured scale claims or new index extension.

Migration applied to the user-confirmed development Supabase database. Existing data/schema are preserved. To withdraw this feature, remove the route/UI exposure and revoke authenticated execution of the RPC; avoid editing applied migration checksums. Cart/checkout will need server-side revalidation, not client inventory snapshots.

## Evidence

Typecheck and production build pass; 149 tests across 15 files pass. HTTP cases cover missing auth, OWNER/EMPLOYEE access, accountant rejection, invalid/injected queries and exact leading-zero barcodes. Isolated PostgreSQL tests cover explicit projection without costs, two-tenant separation, anonymous/accountant/suspended denial, literal search and soft-delete exclusion. Hosted owner UI uses real data without inserting test products into the user's store. Live employee-account UAT and large-data search performance remain pending.

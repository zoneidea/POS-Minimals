# Store settings and staff management

## Owner UI

`/settings` shows store identity, address/phone/tax ID, PromptPay identifier, inclusive VAT switch/rate, receipt footer and print-dialog preference. Editing uses a Modal with a live receipt layout preview. Preview is sample layout, not a committed sale/print integration. Print-dialog preference is stored for the future printing module. PromptPay configuration does not implement or confirm a transfer. Saving refreshes the page data and header store name without rechecking the whole account.

`/users` uses ten-row DataTable pagination. Owners invite EMPLOYEE/ACCOUNTANT by email, edit role/status, suspend/reactivate and soft delete through confirmation Modal. All OWNER rows are protected from edits/removal, a stronger restriction than only preserving the last owner. Names are display aliases, not legal-identity fields; passwords are never listed. All normal reads/writes use verified user JWT and shop scope.

## API contract

Owner-only:
- GET/PATCH `/api/v1/settings/store`: full strict settings object with storeName, address, phone, taxId, promptpayIdentifier, receiptFooter, vatEnabled, vatRate (two-decimal string, 0–100), autoOpenPrintDialog and expected version. PATCH returns `{version}`. Tax ID is empty or 13 digits; PromptPay is empty, 10 or 13 digits. VAT mode remains inclusive.
- GET `/api/v1/users?page=1`: `{items,total,page,limit:10}`; members have id, alias, role, status and version.
- PATCH `/api/v1/users/:id`: `{role:'EMPLOYEE'|'ACCOUNTANT',status:'ACTIVE'|'SUSPENDED'|'DELETED',version}`; returns `{version}`. Owner promotion is not supported. INVITED cannot be activated through a normal status change.
- POST `/api/v1/users/invitations`: `{email,role}`; Auth Admin sends an invitation, then user-scoped owner RPC creates the pending membership; returns `{id}`. Existing application memberships are rejected.

Verified invited account:
- GET `/api/v1/users/invitation`: own pending invitation context `{orgName,role}`. No caller-selected shop/member. Checked before showing password setup.
- POST `/api/v1/users/accept-invitation`: `{alias}`; activates only auth.uid()'s pending member after confirmed email; returns `{orgId}`.

Success envelopes use `{success:true,data}`. 400 validation, 401 unauthenticated, 403 role/account denied, 404 unavailable member/invitation, 409 stale version/protected owner/conflict, 503 unavailable/not configured. Canonical OpenAPI, mirrored docs and generated types updated. Unknown tenant/body fields rejected. Request/response metadata logging excludes bodies, email, passwords and keys.

## Storage, encryption and audit

Migrations `202610120009_store_staff.sql` and `202610120010_invite_context.sql` are additive, initialized by DatabaseInitializer and applied to the confirmed development Supabase. Settings/member row versions prevent lost edits. Store settings save locks the row and updates the organization display name atomically with management audit and activity. Private address, phone, tax ID and PromptPay identifier are AES-256-GCM encrypted server-side with a randomized nonce and store-specific AAD; plaintext contact columns are cleared on save. Retain/back up the existing server-only SALE_SNAPSHOT_KEY while encrypted data exists. Audit copies exclude legacy plaintext private columns. Email identities/passwords remain owned by Supabase Auth; the application does not add email/password columns.

Staff updates serialize on the organization and member row, audit before/after role/status, protect all owners and soft delete. Suspension is enforced by current membership on every API/RPC, not stale token claims. Pending-member creation/acceptance serialize on the same user advisory lock as bootstrap, preserving the one-shop MVP. Management audit is owner-readable through tenant RLS and denies direct writes/deletes. Sensitive settings have no public endpoint in this slice.

## Auth configuration

- Server-only `.env.local`: `SUPABASE_SECRET_KEY` (secret/service-role credential). Never use VITE_ or commit it. The user supplied this locally; presence and a read-only Auth Admin call were verified without printing key/user details. API was restarted to load it.
- `APP_PUBLIC_URL` is the public web origin used for `/join` email redirects. Current fallback is `http://127.0.0.1:5173`; this is suitable only when opening invitations on the development machine. For LAN testing set `APP_PUBLIC_URL=http://192.168.1.110:5173` and restart API.
- Add the corresponding exact `/join` URL under Supabase Authentication → URL Configuration → Redirect URLs, e.g. `http://127.0.0.1:5173/join` (or the LAN origin). Without an allowed redirect Supabase may fall back to its Site URL. Dashboard redirect configuration was not changed by the agent.
- The recipient opens the invitation in their own session/browser, sets their own password and accepts the membership. EMPLOYEE lands on POS; ACCOUNTANT on Reports (reports module remains the next requested milestone). No employee password is set by the owner/agent.

Auth invitation delivery and application membership attachment are separate services, not a single database transaction. If email sends but attachment fails, no ACTIVE rights are granted; administrator reconciliation is required. Automatic resend/compensation/expiry UI is not implemented. No live recipient was invented and no invitation email was sent during agent verification.

## Verification

205 tests across 28 files, typecheck and API/web build pass. New tests cover role/auth gates, strict payloads, version conflict, settings audit rollback, randomized encryption/decryption and wrong-key rejection, pending-member context, confirmed-email activation, cross-shop denial, immediate suspension, owner protection, soft deletion, retained audits and no invitation admin call without a configured key. PGlite is single-connection, not multi-user concurrency proof.

Local IAB desktop 1280×720 and mobile 390×844: real settings/member data load, settings Modal fields/preview, VAT toggle updates the preview without a write, member table protects the owner, invitation Modal is responsive, menu changes stay inside the workspace, console errors empty. The existing shop has only an owner, so live staff edit/suspend/reactivate and real settings-save UAT remain for the user. Invitation/acceptance UAT was pending at implementation time; see subsequent user acceptance below. No test contact data or account was inserted into the real shop. Existing Vite bundle-size warning remains.

Next requested item: Dashboard and reports from real data; not started here.

## User acceptance — 2026-10-12

The user reported **Pass** for sending a real invitation and accepting it. This closes live invite/acceptance UAT based on user-reported testing; the agent did not send an additional email or create another account. Real settings-save and staff role/suspension/reactivation/soft-delete UAT remain unconfirmed.

## User acceptance and store display refinement — 2026-10-12

The user confirmed store settings save and member role change/suspension **Pass**. Reactivation/soft-delete UAT remains unconfirmed. The store information display now uses a themed card with store-name header, icon-labelled responsive columns, full-width address/footer and quieter empty values. This replaces the sparse single-column display highlighted in the user screenshot; receipt preview and settings editing behavior are retained. No API/database changes.

## Inline settings editing — latest user instruction

Store settings are now edited directly on `/settings`, overriding the previous settings Modal requirement for this page only. The responsive form uses two-column fields on desktop and one column on mobile; receipt preview updates live alongside it. Save retains existing validation/encryption/versioned API behavior. Cancel resets all fields and preview to the loaded values without a database write. After saving, the store name in the header updates and current settings reload. Staff Modals remain as specified.

Typecheck/build pass; Local browser verified editable fields without a dialog, VAT preview changing and Cancel restoring the persisted VAT state, and mobile document width 390px at a 390px viewport. Console errors empty. No real store data was changed during UI verification.

User subsequently confirmed the inline store settings form **Pass** before starting Dashboard/reports.

## Direct member controls — 2026-10-22

Owner Users now exposes direct **ปิดใช้งาน / เปิดใช้งาน** controls beside role editing and red member removal. Suspension/reactivation uses the existing versioned `PATCH /api/v1/users/:id` payload `{role,status:'SUSPENDED'|'ACTIVE',version}`; removal remains `status:'DELETED'`, a membership soft delete retaining Auth identity, sales and audit history. No endpoint, database migration or permission expansion is added. Confirmation precedes every change, success dismisses after 1.5 seconds, and failures show a warning and refresh current membership data.

All OWNER rows remain protected. Invited members can be removed; activation and role editing wait for invitation acceptance. The workspace route/menu and StaffPage explicitly require OWNER in addition to backend owner/RLS checks. Cached session authority retains its existing pre-change role fence, preventing reuse of a suspended member's old authorization.

Destructive buttons share a red background/white foreground that overrides neutral theme styles, including logout, product/category deletion, sale cancellation, POS clear-cart and member removal/suspension. Hover/focus/disabled styles and existing confirmation flows remain.

Validation includes owner/non-owner HTTP changes (including forged management permissions/shop IDs and stale versions), isolated PostgreSQL cross-shop/owner protection/suspension/reactivation/soft-delete audit checks, and session-authority invalidation tests. Browser fixture testing exercises cancel/confirm, disable/re-enable/delete, protected owners, non-owner page denial, red actions and responsive light/dark layouts; no real shop member is modified during QA.

## Balanced settings panels — 2026-10-22

Store information and its receipt preview retain their existing layout. Above 1100px, the remaining settings use two equal-width columns: PromptPay and Customer display stack on the left; Printer spans both rows on the right. CSS Grid stretches the columns to exactly matching top/bottom edges without fixed heights or clipping when QR/account fields expand. At 1100px and below, panels flow in one column; mobile display actions also stack. Accountant read-only payment settings, component behavior and all API contracts remain unchanged.

Verification: actual Settings components with isolated fixture data at 1800px and 1280px have equal column widths and matching outer bounds, including QR upload mode. At 390px, panels stack without page overflow in dark mode. Typecheck and production build pass. No real shop settings or Agent connections were modified during layout QA.

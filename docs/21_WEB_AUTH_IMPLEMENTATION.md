# Web authentication — 2026-10-12

Implemented React login/signup, email-confirmation notice, authenticated account identity, retryable organization bootstrap and logout. Supabase Auth receives passwords directly; Express receives only JWTs and bootstrap display fields. Registration metadata is a recovery convenience, never a source of permissions. `/auth/me` remains authoritative for role and organization.

API boundary: GET `/api/v1/auth/me` returns the existing UserContext contract; POST `/api/v1/orgs/bootstrap` accepts `{storeName, displayUsername}` and returns `{orgId, role, status}`. Both use Bearer authentication. No database password or service-role key is bundled in the browser.

A 403 from `/auth/me` cannot distinguish missing membership from suspended membership. UI explains this and offers manual bootstrap; the existing DB transaction rejects suspended/deleted memberships and never grants them access. No automatic mutation is triggered by the 403.

Icons use Lucide with a consistent outline style, paired labels and decorative aria-hidden; password visibility buttons have accessible names. This convention applies to future modules. Forms remain separate reusable modules. Responsive styles support 390px without horizontal overflow.

Local: run `npm run dev:api` and `npm run dev:web`; open http://127.0.0.1:5173. Vite proxies relative `/api` calls to Express. Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are exposed. Add the Local origin to Supabase Auth redirect allowlist for email confirmation.

Validation: TypeScript, backend suite, Web API boundary tests and production builds. Browser checked login/register rendering and 390px width. Reference comparison: centered form, white canvas, green primary, restrained borders, Thai labels preserved; icons added by user instruction. Live signup/email delivery/login/bootstrap not yet proven with a real test account. Hosted deployment configuration, durable frontend activity logging, financial flows and operational screens remain pending.

## Required store contact — 2026-10-14
Registration and onboarding require email and telephone. Email must pass the shared email schema and Supabase verification; onboarding displays the verified account email read-only. Telephone accepts Thai local numbers starting with 0 (9–10 digits) or international + followed by 8–15 digits without separators. Signup metadata retains store_phone for confirmation recovery; it never determines permissions.

POST /orgs/bootstrap now accepts {storeName, displayUsername, phone}; missing/invalid phone returns 400. API validates the verified account email separately rather than accepting an email override. New bootstrap_org_with_contact RPC atomically initializes encrypted store private data with the existing AES-256-GCM format/key, owner membership and audit. Phone is absent from activity logs. The legacy RPC remains for previous-client compatibility; the new web/API flow always requires contact. Existing stores are not modified. Migration 202610140002 must precede deployment.

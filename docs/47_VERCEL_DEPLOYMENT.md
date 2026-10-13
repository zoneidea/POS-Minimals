# Vercel single deployment

Deploy the repository `zoneidea/POS-Minimals` as one Vercel project from repository root. The branch containing current work is `codex/platform-foundation`; do not assume main has these changes. This implements the user's same-origin, one-release requirement while retaining existing web/API modules.

## Project settings

- Root Directory: repository root (`.` / empty), not `apps/web` or `apps/api`.
- Framework Preset: Other. Root vercel.json has framework null.
- Install Command: `npm ci --include=dev`.
- Build Command: `npm run build`.
- Output Directory: `apps/web/dist`.
- Node.js: 22.x, pinned in root package.json and lockfile.
- Git: select correct repository and the branch/commit containing this config. If production tracks main, this work needs merging before deploying main; do not point it at a different repository.

Root vercel.json builds npm workspaces, publishes the Vite static bundle and exposes the existing Express default export through root `api/index.ts`. The capture-free API route dispatches to the API function before filesystem assets and the SPA fallback; other browser routes use index.html. No separate Express deployment is required. API routes retain bearer authorization and same-origin relative URLs. VERCEL suppresses local app.listen and filesystem log writes; safe request metadata goes to stdout. Function maxDuration is 30 seconds. No migrations run during build.

## Environment variables

Add to the Vercel deployment environment that will actually run:

- Public web build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SALE_SNAPSHOT_KEY` (retain the existing value for encrypted historical data), `SUPABASE_SECRET_KEY` for staff invitations.
- `APP_PUBLIC_URL`: the deployed application origin, used for invitations.
- `APP_ALLOWED_ORIGINS`: comma-separated exact application origins, including intended preview origins when testing them. Localhost defaults do not permit browser requests carrying a hosted Origin.

Update Supabase Auth Site URL and redirect allowlist for the deployed domain and existing auth/join/password recovery paths. Server secrets must never use a VITE_ prefix. Do not commit .env.local or paste private keys into build commands. DATABASE_URL is used by the separate migration initializer, not by normal API runtime; local CA paths are not required for the Supabase HTTPS adapter.

## Error diagnosis

`vite: command not found` means the build cannot resolve the CLI. Vite is declared in apps/web devDependencies; root installation including development dependencies and workspace build must complete first. Logs alone cannot establish which dashboard install/root overrides caused the original failure.

The supplied later screenshots instead show pnpm-lock.yaml, Nitro, Better Auth and eve build output with unresolved @opentelemetry/api. This repository uses npm/package-lock.json, React/Vite and Express; it has no Nitro or Better Auth dependency. Verify deployment repository/branch/source before adding a telemetry dependency to POS. The supplied pos-agent-deploy app URL opens Continue with Vercel and does not identify the deployment's Git source to this agent.

## Evidence and remaining verification

Root typecheck and workspace build passed. Fresh isolated copy with no node_modules, dist or local environment files: `npm ci --include=dev` succeeded (0 npm audit vulnerabilities), then API TypeScript and Vite production builds succeeded. Existing bundle-size/deprecation advisories remain. With VERCEL=1, root function entry smoke returns health 200 and unauthenticated sales 401. The earlier smoke expectation of 404 for an unknown protected path was corrected by testing the intended authentication boundary, with no authorization change.

These are local checks, not a hosted Vercel build/routing certification. After redeploy check `/api/v1/health`, refresh `/pos` and `/reports`, sign in, read data, and test Auth redirects and images. Vercel request-body limits apply to hosted uploads separately from Express's local 5 MiB limits; test actual file upload on the deployed host. Durable log retention and full hosted UAT remain pending.

## Hosted deployment — 2026-10-13

- Vercel project: zone-idea/pos-minimals, repository zoneidea/POS-Minimals, production branch codex/platform-foundation (verified from project API after CLI Git connection). Prior pos-agent-deploy project links a different repository and remains unchanged.
- Public URL: https://pos-minimals.vercel.app. Initial deployment dpl_EYaSugHFeNVHwRYUuH3jEhaLp2Gw reached READY. Root framework Other, Node 22.x, install/build/output set per this guide.
- Required public and server variables are configured in Vercel encrypted environment storage for production/preview; APP_PUBLIC_URL and APP_ALLOWED_ORIGINS use the canonical production origin. Existing sale encryption key retained; no private value logged or committed. Preview-specific origins still require explicit allowlisting before authenticated preview testing.
- Anonymous hosted checks: /, /pos and /reports return SPA HTTP 200; /api/v1/health returns JSON status ok; allowed production Origin health returns 200; unauthenticated sales returns 401; JS/CSS assets return 200, with no matching private key values found in assets. Rendered production login page is POS Minimal, no initial console errors. No real sale/stock writes performed.
- Supabase Auth Site URL/redirect configuration cannot yet be inspected: dashboard requires user sign-in. Requested user login before changing/verifying confirmation, password recovery and invitation redirects. Full hosted sign-in/role/image UAT remains pending. Local Excel import and historical bill UAT are separately user-confirmed Pass.

## Hosted strict-query correction — 2026-10-13

The original named rewrite `/api/:path*` forwards `path` into query parameters (see Vercel route-parameter documentation), causing strict schemas to reject Dashboard/catalog/sale/inventory/category requests. Replace the named rewrite with a capture-free PCRE route `^/api(?:/.*)?$` targeting /api/index, followed by filesystem handling and SPA fallback. Genuine user query parameters and their strict validation remain unchanged. Authentication/RLS/business logic is unchanged.

Persistent UI shells now distinguish loading, load failure (ไม่สามารถโหลดข้อมูลได้) and successful empty responses (ไม่มีข้อมูล + dataset name). Tables/pagination and Dashboard/report cards remain mounted, stale rows are hidden on error, financial placeholders show — rather than fabricated zero, and store inputs cannot save while source data is unavailable. 242 tests, typecheck and build pass, including regression rendering and routing cases. Hosted authenticated recheck follows deployment.

The fix is pushed at 9b1e0db and deployed as dpl_DDoGdMjLcjSiXGGvV4daVZhN9eEo (READY), aliased to the existing public URL. Anonymous checks of all five page routes return SPA 200, health returns JSON 200, and protected sales remains JSON 401. User replied ready to test, but both accessible hosted Browser tabs still show login even after deliberate reload; authenticated hosted five-page verification remains pending, not claimed Pass.

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

Root vercel.json builds npm workspaces, publishes the Vite static bundle and exposes the existing Express default export through root `api/index.ts`. `/api/:path*` routes to the API function before the SPA fallback; other browser routes use index.html. No separate Express deployment is required. API routes retain bearer authorization and same-origin relative URLs. VERCEL suppresses local app.listen and filesystem log writes; safe request metadata goes to stdout. Function maxDuration is 30 seconds. No migrations run during build.

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

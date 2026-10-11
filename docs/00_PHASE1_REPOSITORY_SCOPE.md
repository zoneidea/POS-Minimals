# 00 — Project Repository & Phase 1 Delivery Scope (authoritative)

## 1. Fixed repository and project identity
- Product: **POS Minimal** (separate from older POS Lite product).
- **Only official development repository:** `https://github.com/zoneidea/POS-Minimals.git`.
- GitHub owner/name: `zoneidea/POS-Minimals`; default branch observed: `main` (confirm on checkout).
- Repository is currently uninitialized/empty at inspection (2026-10-11). The coding team must initialize it; do not assume prior source exists.
- Use one Monorepo rather than separate Git repositories for Web and API.

## 2. Phase 1 scope: WHAT TO BUILD NOW
1. **React Web App**: TypeScript, Vite, Tailwind CSS, responsive desktop/tablet/mobile browser, Light/Dark, authentication, 2-panel checkout, categories/list/grid/barcode, persistent cart, cash + manually confirmed PromptPay, print receipt 80mm via Web browser/optional locally configured Chrome kiosk, inventory/category management, owner settings & roles, Excel import/export, audit/reverse, reports, owner dashboard and appropriate loading/error states.
2. **Node.js + Express REST API**: One stateless API codebase providing canonical `/api/v1`, JWT + ORG membership + RBAC, DTO validation, business rule enforcement, quote/checkout/idempotency, atomic stock changes, void within 24 hours for OWNER only, audit/snapshot/report logic, safe cache and structured logs.
3. **Supabase**: PostgreSQL with migrations/RLS, Supabase Auth, Storage, tenant isolation by `org_id` and safe transaction/RPC routines. No client-side privileged DB access.
4. **Vercel deployment**: Two Vercel Projects can connect to this exact one GitHub repository: Web root `apps/web` and API root `apps/api`; region near Supabase DB. Managed scale handles Express Function instances; no third Express Project or manually configured load balancer needed for launch.
5. **Quality and operations**: GitHub CI, OpenAPI, TypeScript contract tests, browser E2E, two-org isolation, RBAC, load/lock/idempotency tests, 80mm real-printer UAT, environment separation and backup/rollback guidance.

## 3. Explicitly excluded from Phase 1
- JavaFX Desktop GUI, Java modules, Java HTTP SDK / codegen, Java installer or JavaFX print driver integration.
- Android/iOS Native Application, React Native/Flutter projects, native SDK, native printer bridge or app-store release.
- Cross-client native GUI testing, Java-only PR gates or native/client installer smoke tests.
- Separate backend per platform, self-managed Nginx/Kubernetes/PM2 load balancer, Redis, multi-region distributed databases (unless a future benchmark proves necessary).
- Offline paid sale sync, automatic bank confirmation, universal background silent-printing in ordinary browsers.

These exclusions are **delivery scope only**. Keep HTTP `/api/v1` versioned, stable, technology-neutral to enable future native clients with a separate approval.

## 4. Canonical repository layout
```text
POS-Minimals/
├── apps/
│   ├── web/               # React SPA + Tailwind
│   └── api/               # Node.js + Express stateless REST API
├── packages/
│   └── contracts/         # shared TypeScript schemas / generated types
├── contracts/
│   └── openapi.yaml       # canonical /api/v1 wire contract
├── supabase/
│   ├── migrations/
│   └── tests/
├── docs/                  # documentation in this bundle
├── .github/
│   └── workflows/         # Web/API/migration checks only
├── AGENTS.md
├── DEVELOPMENT_WORKFLOW.md
├── package.json
└── README.md
```
- **Do not create `clients/java-sdk`, `apps/desktop`, `apps/mobile` yet.**
- Shared API may be consumed by future platforms; never branch tenant/permission rules based on User-Agent or client platform metadata.

## 5. Start development
```bash
git clone https://github.com/zoneidea/POS-Minimals.git
cd POS-Minimals
# Repository is empty as inspected; initialize the structure above and commit baseline documentation.
# After scaffolding, set up workspace scripts and lockfile then run actual scripts defined in package.json.
```
**Important:** Empty repositories may need an initial commit and push before some clone/CI/Vercel integration steps can work. Do not claim deployment exists before it has been created and tested.

## 6. Deployment/environment contract
- Vercel Project `pos-minimal-web`: Git repo `zoneidea/POS-Minimals`, root `apps/web`; public `VITE_API_BASE_URL`, public Supabase URL/publishable key (Auth only), no secret keys.
- Vercel Project `pos-minimal-api`: same repo, root `apps/api`; backend Supabase URL, backend-only secret credentials for strictly controlled admin tasks, CORS allowlist, DB connection/pooler only if direct PG access needed.
- Supabase dev/staging/prod separated; no staging pointing at prod DB. Database Region near Vercel API Region.
- Web needs `POST /sales` atomic transaction in DB, never rely on frontend price/stock to determine the final sale.

## 7. Scope change policy
Any request to implement JavaFX GUI, Mobile App, local agent, additional backend service or third-party print device integration requires a **separate explicit Phase 2+ approval**, plan, estimates, acceptance tests and release checklist. Do not silently add these tasks to Phase 1 or block its go-live waiting for native-client features.

## 8. Precedence when older docs mention native clients
1. **This file `00_PHASE1_REPOSITORY_SCOPE.md` overrides older references on which platforms must be developed now.**
2. `README.md` / `AGENTS.md` / `DEVELOPMENT_WORKFLOW.md` implement the Web-first scope.
3. Feature and business rule specs remain valid for Web + API; future-client notes in `15`–`19` are informational only.
4. `13_OPEN_DECISIONS.md` remains the place for unapproved business defaults (except fixed D29–D32).

# Activity history and 30-day application log retention

Owner-only `/audits` now has shop-activity and stock-history tabs. Activity history supports action filters and 10-row pagination, showing Thai time, action, actor display alias, entity and correlation IDs. It reads existing transactionally recorded events: store creation, categories/products/images, stock adjustment, completed/voided sales, settings, staff invitation/acceptance/updates and Excel imports. It is tenant-scoped; browser callers cannot provide an organization ID. Supabase Auth login/password audit events are not imported into this shop history.

## API

`GET /api/v1/audits/activity-logs?page=1&action=SALE_COMPLETED` requires a bearer token and active OWNER identity. `action` is optional, uppercase/underscore max60; extra query fields are rejected. Response:

```json
{"success":true,"data":{"items":[{"id":"uuid","action":"SALE_COMPLETED","entityId":"uuid","actorUsername":"alias or null","requestId":"uuid","createdAt":"UTC ISO timestamp"}],"total":1,"page":1,"limit":10}}
```

Contract and generated types are in `contracts/openapi.yaml` and `packages/contracts/src/generated.ts`. Existing StockHistory contract/retention remains unchanged. Loading/error/empty states retain the complete page UI.

## Persistence and retention

Application Request/Response diagnostics store only request UUID, method, matched route template, HTTP status, duration and server timestamp. Unmatched URLs become `unmatched`; query strings, headers, tokens, request/response payloads and personal contact information are excluded. These diagnostics persist in `private.request_logs` through a service-role-only RPC. Browser roles cannot read/write this table or run retention. Vercel `waitUntil` tracks the write after the response; storage failures emit a safe generic warning without failing a completed business transaction. No mutation retries are introduced.

`public.activity_logs` and `private.request_logs` expire at 30 days. The activity API immediately excludes older entries. Supabase job `pos-log-retention-30-days` runs at minute15 of every hour, deleting rows older than the cutoff and its own scheduler run history older than30 days. Physical cleanup can lag the cutoff by up to one hour. Other scheduler jobs are untouched. Sales, receipt snapshots, stock movements and product/stock business audit records are not deleted by this job.

Migration `202610140001_log_retention.sql` was applied to the confirmed development Supabase on 2026-10-14. `scripts/schedule-log-retention.ts` idempotently creates/enables pg_cron and schedules the named job; execution verified active. Manual purge returned zero expired rows. Restore does not change old migrations; stop expiry by unscheduling only this named job. Deleted log rows cannot be reconstructed except from separately managed backups.

Local diagnostics now use `logs/api-YYYY-MM-DD.jsonl` and remove wholly expired daily files when new requests are logged. Legacy undated local files/backfill artifacts and provider-native Vercel/Supabase platform logs are outside this application retention job; their provider policies are independent. Production app logging requires the existing server-only `SUPABASE_SECRET_KEY` (never sent to the web).

Verification: contract generation/typecheck/build; 48 test files /276 tests passed. Coverage includes owner-only HTTP access, derived tenancy and strict filter validation, old/new log cutoff, denied browser writes/purge/private reads, and local dated-file retention preserving unrelated files. Browser fixtures verify action filtering and mobile overflow. Hosted activity UAT remains user-side.

References: https://supabase.com/docs/guides/cron/quickstart and https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package.

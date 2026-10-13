# Product image performance — 2026-10-13

## Signed URL reuse

Inventory and POS still read current products through a user-scoped client after live Auth/membership checks. Only signed image URL metadata is cached: SHA-256 of the JWT plus the full tenant/product/object path. No token text, permissions, stock, cart or sale state is stored. The cache is capped at 512 entries and reuses URLs for 10 minutes. Storage grants remain 15 minutes, leaving a five-minute reserve for lazy image loads. Hits require no Storage signing request; misses are deduplicated and signed in a batch. Failed signing is not cached. Replacement images use new immutable paths and therefore miss the cache automatically. Token changes separate cache entries.

This cache belongs to one API process. Vercel cold starts, another instance, eviction, expired entries, refreshed JWTs and overlapping initial misses may create new URLs. It does not provide shared cross-instance caching or cache authorization. Existing signed grants retain the same expiry behavior; they are not immediately revoked by later membership changes. The bucket remains private.

## POS thumbnails and compatibility

Image uploads preserve the existing metadata-free WebP original, bounded to 1600x1600 at quality 85, and add a separate WebP thumbnail bounded to 600x440 at quality 75, preserving aspect ratio and avoiding enlargement. Both are uploaded before one version-checked attachment RPC. Immutable UUID filenames remain compatible with existing Storage INSERT policies. Upload cacheControl is 900 seconds.

Migration `202610130007_product_thumbnails.sql` adds nullable image_thumbnail_path. Catalog projection chooses the thumbnail path when present and the original otherwise; the Express adapter still returns the same imageUrl field. Inventory and upload responses retain the original image path/URL. No new public fields or payloads are required; OpenAPI descriptions and generated types document the behavior.

The five-argument set_product_image RPC validates both paths against the authenticated OWNER's shop/product and existing private objects, locks/version-checks once, and records before/after thumbnail paths in product audit plus the existing activity event. The four-argument RPC remains a wrapper; old writers clear stale thumbnails and readers fall back to the new original. Employees can read only current original/thumbnail objects of active products; accountant, anonymous and other-shop reads remain denied. Existing Storage policies invoke the updated access helper; no platform-owned policy DDL or public bucket change is required.

Partial upload or failed attachment can leave unreferenced private objects, as with the existing original-image workflow. No original/history files are deleted automatically.

## Existing images

`DB_ENVIRONMENT=development npm run images:backfill` processes active products with an original but no thumbnail, using server-only Storage credentials for offline maintenance. Ordinary API reads/uploads still use the caller's user client. Download, resize and upload occur outside DB transactions/row locks. Attachment rechecks the current original/thumbnail state under a short lock, then uses the owner's validated RPC and existing audit/version mechanism. This maintenance is attributed to the active shop owner. It modifies image metadata and row_version, without sale/stock/price changes. A concurrent original replacement/deletion or another backfill is skipped instead of overwritten. Resume processes only missing thumbnails; orphan files from interrupted work stay private.

Metadata-only maintenance totals are written to logs/thumbnail-backfill.jsonl and stdout; no bytes, tokens, original filenames, customer fields or credentials are logged. On failure the command stops and reports counts. The database target must be confirmed as development/staging before running.

## Evidence

- 269 tests across 44 files pass, with typecheck and production build passing. Tests cover cache reuse/misses/expiry/capacity/token/tenant separation and failure behavior; thumbnail dimensions/metadata/no-upscale; original+thumbnail upload and partial-failure attachment prevention; RPC version conflict, unavailable/foreign paths, employee/other-shop/accountant access and old-writer fallback.
- The new migration was the only pending migration on the documented development Supabase target and was applied through DatabaseInitializer. Checksum and authenticated/anonymous RPC grants were verified.
- Backfill generated one thumbnail successfully. Read-only verification downloaded and decoded original/thumbnail files and confirmed the live owner catalog projection selects the thumbnail. Original: 548x736, 43,252 bytes. Thumbnail: 328x440, 13,590 bytes (approximately 69% fewer bytes), both WebP without EXIF. Original retained.
- Backfill retry is idempotent for products already carrying thumbnails; no further attachments are needed.

These byte measurements describe the existing image, not a universal latency/TPS improvement. Hosted authenticated image upload/employee visual UAT and multi-instance signing-frequency measurements remain separate checks. Cold-start signing and existing front-end lazy-image behavior remain as described above.

## Release / rollback

Apply the additive migration before deploying the updated API. Old API versions remain compatible during rollout. To roll back the API, keep the added column/helper/catalog projection and originals; legacy catalog adapters still sign the projected path. Any schema rollback must be a reviewed forward migration restoring catalog/access/attachment functions first. Do not edit applied migrations or remove originals or referenced thumbnail objects.

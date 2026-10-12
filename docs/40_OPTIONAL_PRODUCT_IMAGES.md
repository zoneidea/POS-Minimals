# Optional product images

Create/edit product now includes an optional file picker and local preview. No file is required: existing metadata-only creation remains valid. JPG/PNG/WebP up to 5MiB are accepted. Invalid local selections are cleared; cancel releases preview object URLs.

Metadata saves first; the form retains the resulting product ID/version if uploading fails so retries update the same product rather than creating a duplicate. Closing after a partial metadata success reloads inventory. An explicit error tells the user that the image did not complete. Images are shown as inventory thumbnails and POS cards when available; missing images use placehold.co.

## API and validation

`POST /api/v1/inventory/products/:id/image?expectedVersion=N`, Bearer JWT, raw body Content-Type image/jpeg, image/png or image/webp. OWNER only. Server checks product in the verified shop and expected version, then decodes real raster bytes with Sharp. Reject malformed/type-mismatched, animated, oversized (>5MiB) and excessive pixel-count (>16MP) images. Re-encode stripped-metadata WebP, auto-orient and fit within 1600×1600 without upscaling. Store path `<orgId>/<productId>/<randomUUID>.webp` in private bucket `product-images`. Never accept user-supplied arbitrary image URLs or data-URI values for the product record.

Attachment RPC locks/version-checks the product and appends product/activity audit. Files use new immutable paths; replacement does not hard-delete older objects or product history. Storage upload and database attachment are separate operations: a failed attachment can leave an unreferenced private object. Automatic permanent object cleanup is not implemented.

List APIs return `imageUrl` as a short-lived signed read URL (15 minutes); only `imagePath` persists. Reload obtains new URLs. Employee reads are limited to current images of active shop products; accountant/anonymous/other-shop access is denied. The catalog tolerates missing imagePath before migration for compatibility. Storage bucket limits and private access are based on [Supabase bucket documentation](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).

## Storage administration still required

Migration `202610120007_product_images.sql` creates the private bucket and audited attachment/access helpers automatically. Storage objects belong to Supabase's platform role: the current development `postgres` login can insert bucket settings, but is neither the objects owner nor a superuser. It cannot CREATE POLICY on that table. The migration deliberately skips only policy DDL in this situation; it does not alter ownership or grant itself a platform role.

Use Supabase Dashboard with project-owner Storage administration access, open **Storage → Policies → product-images**, and add the following policies targeting **authenticated**. No public/anonymous, UPDATE or DELETE access is needed.

### SELECT — `pos_product_image_read`

```sql
bucket_id = 'product-images'
AND private.product_image_access(name, false)
```

### INSERT — `pos_product_image_insert`

```sql
bucket_id = 'product-images'
AND private.product_image_access(name, true)
AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
```

The corresponding SQL is in `supabase/storage/product-images-policies.sql` for a Storage policy administrator. A normal pooler login cannot apply it with its present permissions. Until these policies exist, image uploading will show a Storage configuration error; adding without an image works.

## Evidence

TypeScript constructor argument order and missing generated `imageUrl` type were fixed. Sequential isolated runs avoid the prior 30-second initialization timeout: 188 tests across 24 files pass, including image decoding/type/size rejection, HTTP auth/owner restrictions, nullable image records, attachment version conflict, tenant Storage RLS and retained objects after soft delete. Typecheck/build pass. Storage is a test-only schema shim in PGlite, not proof of the hosted Storage binary service.

The development migration was applied and the optional field inspected in the live create Modal. Project-owner Storage policy setup and actual hosted upload/thumbnail/POS UAT remain pending. No example products/photos were uploaded into the user's shop.

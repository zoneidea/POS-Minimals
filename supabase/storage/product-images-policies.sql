-- Apply through the Storage policy administration surface with project-owner access.
-- Requires 202610120007_product_images.sql first. No public/anonymous access or deletion grant.
create policy pos_product_image_read on storage.objects for select to authenticated using(bucket_id='product-images' and private.product_image_access(name,false));
create policy pos_product_image_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and private.product_image_access(name,true) and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',false,5242880,array['image/webp']) on conflict(id) do nothing;
create function private.product_image_access(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.products p
 join public.organizations o on o.id=p.org_id
 join public.organization_members m on m.org_id=p.org_id and m.user_id=auth.uid()
 where p.org_id::text=split_part(p_path,'/',1) and p.id::text=split_part(p_path,'/',2)
 and p.deleted_at is null and o.deleted_at is null and o.status='ACTIVE' and m.deleted_at is null and m.status='ACTIVE'
 and (m.role='OWNER' or (not p_write and m.role='EMPLOYEE' and p.image_path=p_path)));
$$;
revoke all on function private.product_image_access(text,boolean) from public,anon;
grant execute on function private.product_image_access(text,boolean) to authenticated;
-- Storage is platform-owned: never change its owner or escalate the DB login.
do $$ begin
 if (select rolsuper from pg_roles where rolname=current_user)
 or (select pg_has_role(current_user,relowner,'USAGE') from pg_class where oid='storage.objects'::regclass) then
create policy pos_product_image_read on storage.objects for select to authenticated using(bucket_id='product-images' and private.product_image_access(name,false));
create policy pos_product_image_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and private.product_image_access(name,true) and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
 else
 raise notice 'Product image Storage policies require project-owner setup through Storage Dashboard.';
 end if;
end $$;
create function public.set_product_image(p_id uuid,p_path text,p_expected_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_row public.products;v_before jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_request_id is null or p_path is null or split_part(p_path,'/',1)<>v_org::text or split_part(p_path,'/',2)<>p_id::text
 or p_path!~'^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_row from public.products where id=p_id and org_id=v_org and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_expected_version is null or p_expected_version<>v_row.row_version then raise sqlstate 'PT409' using message='PRODUCT_VERSION_CONFLICT';end if;
 if not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_path) then raise sqlstate 'PT400' using message='IMAGE_UNAVAILABLE';end if;
 v_before=private.product_json(v_row);
 update public.products set image_path=p_path,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into v_row;
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,request_id)
 values(v_org,p_id,'UPDATE',v_before,private.product_json(v_row),p_expected_version,v_row.row_version,auth.uid(),p_request_id);
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(v_org,auth.uid(),'PRODUCT_IMAGE_UPDATED',p_id,p_request_id);
 return private.product_json(v_row);
end;$$;
revoke all on function public.set_product_image(uuid,text,bigint,uuid) from public,anon;
grant execute on function public.set_product_image(uuid,text,bigint,uuid) to authenticated;

-- Restricted read projection: employees never receive inventory cost/audit columns.
create or replace function public.list_pos_products(p_page integer default 1,p_limit integer default 10,
 p_search text default '',p_barcode text default null,p_category_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE'
 and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN'; end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 100
 or p_search is null or char_length(p_search)>200 or (p_barcode is not null and char_length(p_barcode) not between 1 and 100)
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
 with filtered as materialized (
  select p.id,p.name,p.barcode,p.category_id,p.sale_price,p.quantity_on_hand,p.row_version,p.image_path
  from public.products p where p.org_id=v_org and p.deleted_at is null
  and (p_category_id is null or p.category_id=p_category_id)
  and (p_barcode is null or p.barcode=p_barcode)
  and (p_search='' or position(lower(p_search) in lower(p.name))>0 or position(lower(p_search) in lower(p.barcode))>0)
 ), paged as (select * from filtered order by name,id offset (p_page-1)*p_limit limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'name',name,'barcode',barcode,'categoryId',category_id,'salePrice',sale_price::text,
  'quantityOnHand',quantity_on_hand,'rowVersion',row_version,'imageUrl',null,'imagePath',image_path) order by name,id) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',p_page,'limit',p_limit) into v_result;
 return v_result;
end;
$$;
revoke all on function public.list_pos_products(integer,integer,text,text,uuid) from public,anon;
grant execute on function public.list_pos_products(integer,integer,text,text,uuid) to authenticated;

notify pgrst,'reload schema';

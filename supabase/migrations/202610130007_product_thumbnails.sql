alter table public.products add column image_thumbnail_path text;
create or replace function private.product_image_access(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.products p
 join public.organizations o on o.id=p.org_id
 join public.organization_members m on m.org_id=p.org_id and m.user_id=auth.uid()
 where p.org_id::text=split_part(p_path,'/',1) and p.id::text=split_part(p_path,'/',2)
 and p.deleted_at is null and o.deleted_at is null and o.status='ACTIVE' and m.deleted_at is null and m.status='ACTIVE'
 and (m.role='OWNER' or (not p_write and m.role='EMPLOYEE' and (p.image_path=p_path or p.image_thumbnail_path=p_path))));
$$;
revoke all on function private.product_image_access(text,boolean) from public,anon;
grant execute on function private.product_image_access(text,boolean) to authenticated;
create or replace function public.set_product_image(p_id uuid,p_path text,p_expected_version bigint,p_request_id uuid,p_thumbnail_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_row public.products;v_before jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_request_id is null or p_path is null or split_part(p_path,'/',1)<>v_org::text or split_part(p_path,'/',2)<>p_id::text
 or p_path!~'^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_thumbnail_path is not null and (split_part(p_thumbnail_path,'/',1)<>v_org::text or split_part(p_thumbnail_path,'/',2)<>p_id::text or p_thumbnail_path!~'^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' or p_thumbnail_path=p_path) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_row from public.products where id=p_id and org_id=v_org and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_expected_version is null or p_expected_version<>v_row.row_version then raise sqlstate 'PT409' using message='PRODUCT_VERSION_CONFLICT';end if;
 if not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_path) then raise sqlstate 'PT400' using message='IMAGE_UNAVAILABLE';end if;
 if p_thumbnail_path is not null and not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_thumbnail_path) then raise sqlstate 'PT400' using message='IMAGE_UNAVAILABLE';end if;
 v_before=private.product_json(v_row)||jsonb_build_object('thumbnailPath',v_row.image_thumbnail_path);
 update public.products set image_path=p_path,image_thumbnail_path=p_thumbnail_path,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into v_row;
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,request_id)
 values(v_org,p_id,'UPDATE',v_before,private.product_json(v_row)||jsonb_build_object('thumbnailPath',v_row.image_thumbnail_path),p_expected_version,v_row.row_version,auth.uid(),p_request_id);
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(v_org,auth.uid(),'PRODUCT_IMAGE_UPDATED',p_id,p_request_id);
 return private.product_json(v_row);
end;$$;
revoke all on function public.set_product_image(uuid,text,bigint,uuid,text) from public,anon;
grant execute on function public.set_product_image(uuid,text,bigint,uuid,text) to authenticated;

create or replace function public.set_product_image(p_id uuid,p_path text,p_expected_version bigint,p_request_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select public.set_product_image(p_id,p_path,p_expected_version,p_request_id,null);
$$;
create or replace function public.list_pos_products(p_page integer default 1,p_limit integer default 10,
 p_search text default '',p_barcode text default null,p_category_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_where text=' from public.products where org_id=$1 and deleted_at is null';
 v_pattern text;v_total bigint;v_rows jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE'
 and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 100
 or p_search is null or char_length(p_search)>200 or (p_barcode is not null and char_length(p_barcode) not between 1 and 100)
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_category_id is not null then v_where=v_where||' and category_id=$2';end if;
 if p_barcode is not null then v_where=v_where||' and barcode=$3';end if;
 if p_search<>'' then
 -- LIKE retains literal substring semantics, including %, _ and backslash.
 v_pattern='%'||replace(replace(replace(lower(p_search),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
 v_where=v_where||' and (lower(name) like $4 or lower(barcode) like $4)';
 end if;
 execute 'select count(*)'||v_where into v_total using v_org,p_category_id,p_barcode,v_pattern;
 execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''barcode'',barcode,''categoryId'',category_id,''salePrice'',sale_price::text,''quantityOnHand'',quantity_on_hand,''rowVersion'',row_version,''imageUrl'',null,''imagePath'',coalesce(image_thumbnail_path,image_path)) order by name,id),''[]''::jsonb) from (select id,name,barcode,category_id,sale_price,quantity_on_hand,row_version,image_path,image_thumbnail_path'||v_where||' order by name,id offset $5 limit $6) paged'
 into v_rows using v_org,p_category_id,p_barcode,v_pattern,(p_page-1)*p_limit,p_limit;
 return jsonb_build_object('items',v_rows,'total',v_total,'page',p_page,'limit',p_limit);
end;$$;
notify pgrst,'reload schema';

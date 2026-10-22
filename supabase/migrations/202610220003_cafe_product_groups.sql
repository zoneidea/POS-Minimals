-- Optional cafe metadata saves reuse the legacy product/stock routines atomically.
create function public.manage_cafe_product(p_operation text,p_id uuid,p_barcode text,p_name text,p_category_id uuid,
 p_sale_price numeric,p_unit_cost numeric,p_expected_version bigint,p_request_id uuid,p_quantity integer,p_group_ids uuid[],p_group_versions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;result jsonb;pid uuid;old_ids uuid[];next_ids uuid[];v jsonb;
begin
 org=private.coupon_org(array['OWNER'],false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null for share;
 if mode is distinct from 'CAFE' then raise sqlstate 'PT409' using message='CAFE_MODE_REQUIRED';end if;
 if p_operation is null or p_operation not in ('create','update') or (p_operation='create' and p_id is not null)
 or p_quantity is null or p_quantity<0 or (p_operation='update' and p_quantity<>0) or p_group_ids is null or cardinality(p_group_ids)>200 or array_position(p_group_ids,null) is not null
 or (select count(distinct x) from unnest(p_group_ids) x)<>cardinality(p_group_ids)
 or p_group_versions is null or jsonb_typeof(p_group_versions)<>'array' or jsonb_array_length(p_group_versions)>200 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 for v in select value from jsonb_array_elements(p_group_versions) loop
 if jsonb_typeof(v)<>'object' or (v-array['id','version'])<>'{}'::jsonb or not(v ?& array['id','version']) or coalesce(v->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'version')<>'number' or coalesce(v->>'version','')!~'^[1-9][0-9]{0,15}$' or (v->>'version')::numeric>9007199254740991 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_group_versions))<>jsonb_array_length(p_group_versions) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 -- Product row before configuration lock, matching cafe checkout and group editing.
 if p_operation='create' and p_quantity>0 then
 result=public.create_product_with_stock(p_operation,p_id,p_barcode,p_name,p_category_id,p_sale_price,p_unit_cost,p_expected_version,p_request_id,p_quantity);
 else result=public.manage_product(p_operation,p_id,p_barcode,p_name,p_category_id,p_sale_price,p_unit_cost,p_expected_version,p_request_id);end if;
 pid=(result->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':cafe-config',0));
 if (select count(*) from public.cafe_option_groups g where g.org_id=org and g.deleted_at is null and g.id=any(p_group_ids))<>cardinality(p_group_ids) then raise sqlstate 'PT400' using message='OPTION_UNAVAILABLE';end if;
 select coalesce(array_agg(group_id order by group_id),'{}') into old_ids from public.cafe_product_groups where org_id=org and product_id=pid;
 select coalesce(array_agg(x order by x),'{}') into next_ids from unnest(p_group_ids) x;
 if old_ids is distinct from next_ids then
 if exists(select 1 from public.cafe_option_groups g where g.org_id=org and g.deleted_at is null and (g.id=any(old_ids) or g.id=any(next_ids)) and not exists(select 1 from jsonb_array_elements(p_group_versions) x where (x->>'id')::uuid=g.id and (x->>'version')::bigint=g.row_version)) then raise sqlstate 'PT409' using message='CAFE_OPTIONS_CHANGED';end if;
 delete from public.cafe_product_groups where org_id=org and product_id=pid;
 insert into public.cafe_product_groups(org_id,product_id,group_id) select org,pid,x from unnest(next_ids) x;
 update public.cafe_option_groups set row_version=row_version+1 where org_id=org and (id=any(old_ids) or id=any(next_ids));
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_PRODUCT_OPTIONS_SAVED',pid,p_request_id);
 end if;
 return result;
end;$$;
revoke all on function public.manage_cafe_product(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid,integer,uuid[],jsonb) from public,anon,service_role;
grant execute on function public.manage_cafe_product(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid,integer,uuid[],jsonb) to authenticated;
notify pgrst,'reload schema';

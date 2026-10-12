create table private.inventory_import_batches (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 actor_user_id uuid not null references auth.users(id), rows_json jsonb not null, errors_json jsonb not null,
 status text not null check(status in ('READY','INVALID','COMMITTED')), result_json jsonb,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 hour',
 committed_at timestamptz
);
alter table private.inventory_import_batches enable row level security;
revoke all on private.inventory_import_batches from public,anon,authenticated;
create index inventory_import_actor on private.inventory_import_batches(org_id,actor_user_id,created_at desc);
create function public.inventory_import(p_operation text,p_id uuid,p_rows jsonb,p_errors jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; b private.inventory_import_batches%rowtype; r jsonb; c uuid; v_errors jsonb;
 v_rows jsonb='[]'::jsonb; v_seen text[]='{}'; v_product public.products%rowtype; v_count int=0;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null
 and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise exception using errcode='PT403',message='FORBIDDEN'; end if;
 if p_operation is null or p_operation not in ('preview','commit','get') or (p_operation<>'get' and p_request_id is null) then raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
 if p_operation='preview' then
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_errors) is distinct from 'array' then raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
  if jsonb_array_length(p_rows)+jsonb_array_length(p_errors)=0 or jsonb_array_length(p_rows)>1000 or jsonb_array_length(p_errors)>1000 then raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
  v_errors=p_errors;
  for r in select value from jsonb_array_elements(p_rows) loop
   if jsonb_typeof(r)<>'object' or (select count(*) from jsonb_object_keys(r))<>7
    or jsonb_typeof(r->'barcode') is distinct from 'string' or char_length(btrim(r->>'barcode')) not between 1 and 100
    or jsonb_typeof(r->'name') is distinct from 'string' or char_length(btrim(r->>'name')) not between 1 and 200
    or jsonb_typeof(r->'category') is distinct from 'string' or char_length(r->>'category')>120
    or jsonb_typeof(r->'salePrice') is distinct from 'string' or (r->>'salePrice')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$'
    or jsonb_typeof(r->'unitCost') is distinct from 'string' or (r->>'unitCost')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$'
    or jsonb_typeof(r->'quantity') is distinct from 'number' or (r->>'quantity')!~'^[0-9]+$'
    or (r->>'quantity')::numeric>2147483647
    or jsonb_typeof(r->'row') is distinct from 'number' or (r->>'row')!~'^[0-9]+$' or (r->>'row')::numeric not between 2 and 1001
   then raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
   r=jsonb_set(jsonb_set(r,'{barcode}',to_jsonb(btrim(r->>'barcode'))),'{name}',to_jsonb(btrim(r->>'name')));
   c=null;
   if btrim(r->>'category')<>'' then
    select id into c from public.categories where org_id=v_org and deleted_at is null and name=btrim(r->>'category');
    if c is null then v_errors=v_errors||jsonb_build_array(jsonb_build_object('row',(r->>'row')::int,'message','ไม่พบหมวดหมู่ในร้าน')); end if;
   end if;
   if (r->>'barcode')=any(v_seen) or exists(select 1 from public.products where org_id=v_org and barcode=r->>'barcode') then
    v_errors=v_errors||jsonb_build_array(jsonb_build_object('row',(r->>'row')::int,'message','barcode ซ้ำหรือเคยใช้แล้ว'));
   end if;
   v_seen=array_append(v_seen,r->>'barcode');v_rows=v_rows||jsonb_build_array(r||jsonb_build_object('categoryId',c));
  end loop;
  insert into private.inventory_import_batches(org_id,actor_user_id,rows_json,errors_json,status)
  values(v_org,auth.uid(),v_rows,v_errors,case when jsonb_array_length(v_errors)=0 then 'READY' else 'INVALID' end) returning * into b;
 else
  select * into b from private.inventory_import_batches where id=p_id and org_id=v_org and actor_user_id=auth.uid() for update;
  if not found then raise exception using errcode='PT404',message='NOT_FOUND'; end if;
  if b.status='COMMITTED' then return b.result_json; end if;
  if p_operation='commit' then
   if b.status<>'READY' or b.expires_at<clock_timestamp() then raise exception using errcode='PT409',message='IMPORT_UNAVAILABLE'; end if;
   -- Batch row lock makes retries serial; unique(org_id,barcode) also arbitrates
   -- concurrent manual creates / other batches. Any conflict rolls everything back.
   for r in select value from jsonb_array_elements(b.rows_json) order by value->>'categoryId',value->>'barcode' loop
    c=(r->>'categoryId')::uuid;
    if c is not null then
     perform 1 from public.categories where id=c and org_id=v_org and deleted_at is null and name=btrim(r->>'category') for share;
     if not found then raise exception using errcode='PT409',message='CATEGORY_CHANGED'; end if;
    end if;
    insert into public.products(org_id,category_id,barcode,name,sale_price,unit_cost,quantity_on_hand,created_by,updated_by)
    values(v_org,c,r->>'barcode',r->>'name',(r->>'salePrice')::numeric,(r->>'unitCost')::numeric,(r->>'quantity')::int,auth.uid(),auth.uid()) returning * into v_product;
    insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,reason,request_id)
    values(v_org,v_product.id,'IMPORT',null,private.product_json(v_product),null,1,auth.uid(),'Excel import '||b.id::text,p_request_id);
    if v_product.quantity_on_hand>0 then
     insert into public.stock_movements(org_id,product_id,movement_type,quantity_delta,quantity_before,quantity_after,product_name_snapshot,barcode_snapshot,reason,performed_by,request_id,request_key,input_json,result_json)
     values(v_org,v_product.id,'IMPORT_INITIAL',v_product.quantity_on_hand,0,v_product.quantity_on_hand,v_product.name,v_product.barcode,'Excel import '||b.id::text,auth.uid(),p_request_id,gen_random_uuid(),jsonb_build_object('batchId',b.id,'row',r->'row'),private.product_json(v_product));
    end if;
    v_count=v_count+1;
   end loop;
   b.status='COMMITTED';
   b.result_json=jsonb_build_object('batchId',b.id,'expiresAt',b.expires_at,'rows',b.rows_json,'errors',b.errors_json,'status',b.status,'importedCount',v_count);
   update private.inventory_import_batches set status=b.status,committed_at=clock_timestamp(),result_json=b.result_json where id=b.id;
   insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(v_org,auth.uid(),'INVENTORY_IMPORTED',b.id,p_request_id);
   return b.result_json;
  end if;
 end if;
 return jsonb_build_object('batchId',b.id,'expiresAt',b.expires_at,'rows',b.rows_json,'errors',b.errors_json,'status',b.status,'importedCount',0);
exception when unique_violation then raise exception using errcode='PT409',message='BARCODE_EXISTS';
end; $$;
revoke all on function public.inventory_import(text,uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.inventory_import(text,uuid,jsonb,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';

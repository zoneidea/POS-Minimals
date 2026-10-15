-- Optional stock reason retains actor, before/after quantities and timestamps.
alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check check(char_length(btrim(reason)) between 0 and 500);
create or replace function public.adjust_product_stock(p_id uuid,p_delta integer,p_reason text,p_expected_version bigint,p_key uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_row public.products%rowtype; v_before jsonb; v_before_version bigint; v_quantity integer;
 v_next bigint; v_input jsonb; v_existing public.stock_movements%rowtype; v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null
 and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise exception using errcode='PT403',message='FORBIDDEN'; end if;
 if p_id is null or p_key is null or p_request_id is null or p_delta is null or p_delta=0
 or p_reason is null or char_length(btrim(p_reason)) not between 0 and 500 or p_expected_version is null then
 raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
 v_input=jsonb_build_object('id',p_id,'delta',p_delta,'reason',btrim(p_reason),'expectedVersion',p_expected_version,'actor',auth.uid());
 perform pg_advisory_xact_lock(hashtextextended(v_org::text||':'||p_key::text,0));
 select * into v_existing from public.stock_movements where org_id=v_org and request_key=p_key;
 if found then
 if v_existing.input_json<>v_input then raise exception using errcode='PT409',message='IDEMPOTENCY_CONFLICT'; end if;
 return v_existing.result_json;
 end if;
 select * into v_row from public.products where id=p_id and org_id=v_org and deleted_at is null for update;
 if not found then raise exception using errcode='PT404',message='NOT_FOUND'; end if;
 if p_expected_version<>v_row.row_version then raise exception using errcode='PT409',message='PRODUCT_VERSION_CONFLICT'; end if;
 v_next=v_row.quantity_on_hand::bigint+p_delta::bigint;
 if v_next<0 then raise exception using errcode='PT409',message='INSUFFICIENT_STOCK'; end if;
 if v_next>2147483647 then raise exception using errcode='PT400',message='STOCK_LIMIT_EXCEEDED'; end if;
 v_before=private.product_json(v_row); v_before_version=v_row.row_version; v_quantity=v_row.quantity_on_hand;
 update public.products set quantity_on_hand=v_next::integer,row_version=row_version+1,updated_at=now(),updated_by=auth.uid()
 where id=v_row.id returning * into v_row;
 v_result=private.product_json(v_row);
 insert into public.stock_movements(org_id,product_id,movement_type,quantity_delta,quantity_before,quantity_after,
 product_name_snapshot,barcode_snapshot,reason,performed_by,request_id,request_key,input_json,result_json)
 values(v_org,v_row.id,case when p_delta>0 then 'ADJUST_IN' else 'ADJUST_OUT' end,p_delta,v_quantity,v_row.quantity_on_hand,
 v_row.name,v_row.barcode,btrim(p_reason),auth.uid(),p_request_id,p_key,v_input,v_result);
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,reason,request_id)
 values(v_org,v_row.id,'STOCK_ADJUST',v_before,v_result,v_before_version,v_row.row_version,auth.uid(),btrim(p_reason),p_request_id);
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id)
 values(v_org,auth.uid(),'STOCK_ADJUST',v_row.id,p_request_id);
 return v_result;
end; $$;

-- Same authenticated owner authorization and audit routines, one database transaction.
create function public.create_product_with_stock(p_operation text,p_id uuid,p_barcode text,p_name text,p_category_id uuid,
 p_sale_price numeric,p_unit_cost numeric,p_expected_version bigint,p_request_id uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_operation is distinct from 'create' or p_id is not null or p_quantity is null or p_quantity<1 then
 raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 result=public.manage_product('create',null,p_barcode,p_name,p_category_id,p_sale_price,p_unit_cost,null,p_request_id);
 return public.adjust_product_stock((result->>'id')::uuid,p_quantity,'จำนวนสินค้าเริ่มต้น',(result->>'version')::bigint,(result->>'id')::uuid,p_request_id);
end;$$;
revoke all on function public.create_product_with_stock(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid,integer) from public,anon,service_role;
grant execute on function public.create_product_with_stock(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid,integer) to authenticated;
notify pgrst,'reload schema';

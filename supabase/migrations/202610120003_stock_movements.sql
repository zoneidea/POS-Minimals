create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 product_id uuid not null, movement_type text not null check(movement_type in ('SALE_OUT','SALE_VOID_IN','ADJUST_IN','ADJUST_OUT','IMPORT_INITIAL')),
 quantity_delta integer not null check(quantity_delta<>0), quantity_before integer not null check(quantity_before>=0),
 quantity_after integer not null check(quantity_after>=0),
 product_name_snapshot text not null, barcode_snapshot text not null,
 reason text not null check(char_length(btrim(reason)) between 1 and 500),
 performed_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 request_id uuid not null, request_key uuid not null, input_json jsonb not null, result_json jsonb not null,
 unique(org_id,request_key), foreign key(org_id,product_id) references public.products(org_id,id),
 check(quantity_before::bigint+quantity_delta::bigint=quantity_after::bigint)
);
create index stock_movements_history on public.stock_movements(org_id,created_at desc,id desc);
create index stock_movements_product_history on public.stock_movements(org_id,product_id,created_at desc,id desc);
alter table public.stock_movements enable row level security;
revoke all on public.stock_movements from anon,authenticated;
grant select on public.stock_movements to authenticated;
create policy stock_movements_owner_read on public.stock_movements for select to authenticated
 using(private.current_org_role(org_id)='OWNER');
create function public.adjust_product_stock(p_id uuid,p_delta integer,p_reason text,p_expected_version bigint,p_key uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_row public.products%rowtype; v_before jsonb; v_before_version bigint; v_quantity integer;
 v_next bigint; v_input jsonb; v_existing public.stock_movements%rowtype; v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null
 and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise exception using errcode='PT403',message='FORBIDDEN'; end if;
 if p_id is null or p_key is null or p_request_id is null or p_delta is null or p_delta=0
 or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 or p_expected_version is null then
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
revoke all on function public.adjust_product_stock(uuid,integer,text,bigint,uuid,uuid) from public,anon;
grant execute on function public.adjust_product_stock(uuid,integer,text,bigint,uuid,uuid) to authenticated;
notify pgrst,'reload schema';

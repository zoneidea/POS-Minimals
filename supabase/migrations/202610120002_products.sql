create table public.products (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 category_id uuid, barcode text not null check(char_length(btrim(barcode)) between 1 and 100),
 name text not null check(char_length(btrim(name)) between 1 and 200), image_path text,
 sale_price numeric(14,2) not null default 0 check(sale_price >= 0),
 unit_cost numeric(14,2) not null default 0 check(unit_cost >= 0),
 quantity_on_hand integer not null default 0 check(quantity_on_hand >= 0),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
 deleted_at timestamptz, deleted_by uuid references auth.users(id),
 unique(org_id,id), unique(org_id,barcode),
 foreign key(org_id,category_id) references public.categories(org_id,id)
);
create index products_active_list on public.products(org_id,name,id) where deleted_at is null;
create index products_active_category on public.products(org_id,category_id) where deleted_at is null;
create table public.product_audit_logs (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 product_id uuid not null, action text not null check(action in ('CREATE','UPDATE','STOCK_ADJUST','DELETE','REVERSE','IMPORT')),
 before_json jsonb, after_json jsonb not null, before_version bigint, after_version bigint not null,
 actor_user_id uuid not null references auth.users(id), reason text, reversed_event_id uuid,
 created_at timestamptz not null default now(), request_id uuid not null,
 foreign key(org_id,product_id) references public.products(org_id,id)
);
create index product_audit_history on public.product_audit_logs(org_id,product_id,created_at desc);
alter table public.products enable row level security;
alter table public.product_audit_logs enable row level security;
revoke all on public.products,public.product_audit_logs from anon,authenticated;
grant select on public.products,public.product_audit_logs to authenticated;
-- Full inventory contains cost; employee catalog will use a restricted projection RPC.
create policy products_owner_read on public.products for select to authenticated
 using(deleted_at is null and private.current_org_role(org_id)='OWNER');
create policy product_audit_owner_read on public.product_audit_logs for select to authenticated
 using(private.current_org_role(org_id)='OWNER');

create function private.product_json(p public.products) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.id,'categoryId',p.category_id,'barcode',p.barcode,'name',p.name,
 'salePrice',p.sale_price::text,'unitCost',p.unit_cost::text,'quantity',p.quantity_on_hand,
 'version',p.row_version,'imagePath',p.image_path);
$$;
revoke all on function private.product_json(public.products) from public,anon,authenticated;
create function public.manage_product(p_operation text,p_id uuid,p_barcode text,p_name text,p_category_id uuid,
 p_sale_price numeric,p_unit_cost numeric,p_expected_version bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_row public.products%rowtype; v_before jsonb; v_before_version bigint;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null
 and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise exception using errcode='PT403',message='FORBIDDEN'; end if;
 if p_request_id is null or p_operation is null or p_operation not in ('create','update','delete') then
 raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
 if p_operation<>'delete' then
 if p_barcode is null or char_length(btrim(p_barcode)) not between 1 and 100
 or p_name is null or char_length(btrim(p_name)) not between 1 and 200
 or p_sale_price is null or p_unit_cost is null
 or p_sale_price not between 0 and 999999999999.99 or p_unit_cost not between 0 and 999999999999.99
 or p_sale_price<>round(p_sale_price,2) or p_unit_cost<>round(p_unit_cost,2) then
 raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
 end if;
 if p_operation<>'create' then
 select * into v_row from public.products where id=p_id and org_id=v_org and deleted_at is null for update;
 if not found then raise exception using errcode='PT404',message='NOT_FOUND'; end if;
 if p_expected_version is null or p_expected_version<>v_row.row_version then
 raise exception using errcode='PT409',message='PRODUCT_VERSION_CONFLICT'; end if;
 v_before=private.product_json(v_row); v_before_version=v_row.row_version;
 end if;
 if p_operation<>'delete' and p_category_id is not null then
 -- Shares the category lock with its delete RPC: no product can attach after deletion.
 perform 1 from public.categories where id=p_category_id and org_id=v_org and deleted_at is null for share;
 if not found then raise exception using errcode='PT400',message='CATEGORY_UNAVAILABLE'; end if;
 end if;
 if p_operation='create' then
 insert into public.products(org_id,category_id,barcode,name,sale_price,unit_cost,created_by,updated_by)
 values(v_org,p_category_id,btrim(p_barcode),btrim(p_name),p_sale_price,p_unit_cost,auth.uid(),auth.uid()) returning * into v_row;
 elsif p_operation='update' then
 update public.products set category_id=p_category_id,barcode=btrim(p_barcode),name=btrim(p_name),
 sale_price=p_sale_price,unit_cost=p_unit_cost,row_version=row_version+1,updated_at=now(),updated_by=auth.uid()
 where id=v_row.id returning * into v_row;
 else
 update public.products set deleted_at=now(),deleted_by=auth.uid(),row_version=row_version+1,updated_at=now(),updated_by=auth.uid()
 where id=v_row.id returning * into v_row;
 end if;
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,request_id)
 values(v_org,v_row.id,upper(p_operation),v_before,private.product_json(v_row),v_before_version,v_row.row_version,auth.uid(),p_request_id);
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id)
 values(v_org,auth.uid(),'PRODUCT_'||upper(p_operation),v_row.id,p_request_id);
 return private.product_json(v_row);
exception when unique_violation then raise exception using errcode='PT409',message='BARCODE_EXISTS';
end; $$;
revoke all on function public.manage_product(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid) from public,anon;
grant execute on function public.manage_product(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid) to authenticated;
notify pgrst,'reload schema';

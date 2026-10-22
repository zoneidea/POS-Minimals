-- Restaurant phase 1: staff-operated tables, immutable rounds and atomic cash settlement.
-- Existing RETAIL/CAFE data and request contracts keep their behavior.
alter table public.store_settings drop constraint store_settings_store_mode_check;
alter table public.store_settings add constraint store_settings_store_mode_check check(store_mode in ('RETAIL','CAFE','RESTAURANT'));


create or replace function public.bootstrap_org_with_mode(p_store_name text, p_display_username text, p_request_id uuid, p_private_cipher text, p_store_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_member public.organization_members%rowtype;
begin
  if v_user is null then raise exception using errcode = 'PT401', message = 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception using errcode = 'PT403', message = 'EMAIL_NOT_VERIFIED';
  end if;
  if p_store_mode is null or p_store_mode not in ('RETAIL','CAFE','RESTAURANT') or p_store_name is null or char_length(btrim(p_store_name)) not between 1 and 120
    or p_display_username is null or char_length(btrim(p_display_username)) not between 1 and 80
    or p_private_cipher is null or char_length(p_private_cipher) not between 1 and 10000
    or p_request_id is null then
    raise exception using errcode = 'PT400', message = 'VALIDATION_ERROR';
  end if;
  -- Serialize all provisioning attempts for the same auth user, across API instances.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select * into v_member from public.organization_members where user_id = v_user
    order by created_at, id limit 1;
  if found then
    if v_member.status <> 'ACTIVE' or v_member.deleted_at is not null
      or not exists (select 1 from public.organizations where id = v_member.org_id and status = 'ACTIVE' and deleted_at is null) then
      raise exception using errcode = 'PT403', message = 'FORBIDDEN';
    end if;
    if v_member.role <> 'OWNER' then
      raise exception using errcode = 'PT409', message = 'ORG_ALREADY_PROVISIONED';
    end if;
    return jsonb_build_object('orgId', v_member.org_id, 'role', 'OWNER', 'status', 'ACTIVE');
  end if;
  insert into public.organizations(name) values (btrim(p_store_name)) returning id into v_org;
  insert into public.organization_members(org_id, user_id, display_username, role)
    values (v_org, v_user, btrim(p_display_username), 'OWNER');
  insert into public.store_settings(org_id, store_name, private_cipher, updated_by, store_mode)
    values (v_org, btrim(p_store_name), p_private_cipher, v_user, p_store_mode);
  insert into public.activity_logs(org_id, actor_user_id, action, entity_id, request_id)
    values (v_org, v_user, 'ORG_BOOTSTRAPPED', v_org, p_request_id);
  return jsonb_build_object('orgId', v_org, 'role', 'OWNER', 'status', 'ACTIVE');
end;
$$;

create or replace function public.save_store_settings(p_input jsonb,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_before public.store_settings;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and private.current_org_role(m.org_id)='OWNER' and m.status='ACTIVE' and m.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_request is null or p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['storeName','vatEnabled','vatRate','receiptFooter','autoOpenPrintDialog','privateCipher','storeMode'])<>'{}'::jsonb or not(p_input ?& array['storeName','vatEnabled','vatRate','receiptFooter','autoOpenPrintDialog','privateCipher'])
 or (p_input ? 'storeMode' and (p_input->>'storeMode' is null or p_input->>'storeMode' not in ('RETAIL','CAFE','RESTAURANT')))
 or char_length(btrim(coalesce(p_input->>'storeName',''))) not between 1 and 120 or jsonb_typeof(p_input->'vatEnabled')<>'boolean' or jsonb_typeof(p_input->'autoOpenPrintDialog')<>'boolean' or coalesce(p_input->>'vatRate','')!~'^(0|[1-9][0-9]{0,2})\.[0-9]{2}$' or (p_input->>'vatRate')::numeric>100 or char_length(coalesce(p_input->>'receiptFooter',''))>1000 or char_length(coalesce(p_input->>'privateCipher','')) not between 1 and 20000 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_before from public.store_settings where org_id=v_org and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_version is null or v_before.row_version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.store_settings set store_mode=coalesce(p_input->>'storeMode',store_mode),store_name=btrim(p_input->>'storeName'),vat_enabled=(p_input->>'vatEnabled')::boolean,vat_rate=(p_input->>'vatRate')::numeric,receipt_footer=p_input->>'receiptFooter',auto_open_print_dialog=(p_input->>'autoOpenPrintDialog')::boolean,private_cipher=p_input->>'privateCipher',address=null,phone=null,tax_id=null,promptpay_identifier=null,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where org_id=v_org;
 update public.organizations set name=btrim(p_input->>'storeName') where id=v_org;
 insert into public.management_audit_logs(org_id,entity_id,action,before_json,after_json,actor_user_id,request_id) select v_org,v_org,'STORE_SETTINGS_UPDATE',to_jsonb(v_before)-array['address','phone','tax_id','promptpay_identifier'],to_jsonb(s)-array['address','phone','tax_id','promptpay_identifier'],auth.uid(),p_request from public.store_settings s where s.org_id=v_org;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_org,v_org,'STORE_SETTINGS_UPDATE',auth.uid(),p_request);
 return jsonb_build_object('version',v_before.row_version+1);
end;$$;

create or replace function public.cafe_option_configuration(p_management boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;groups jsonb;
begin
 org=private.coupon_org(case when p_management then array['OWNER'] else array['OWNER','EMPLOYEE','ACCOUNTANT'] end,false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'minChoices',g.min_choices,'maxChoices',g.max_choices,'enabled',g.enabled,'version',g.row_version,
 'productIds',(select coalesce(jsonb_agg(a.product_id order by a.product_id),'[]') from public.cafe_product_groups a join public.products ap on ap.org_id=a.org_id and ap.id=a.product_id and ap.deleted_at is null where a.org_id=org and a.group_id=g.id),
 'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price::text,'enabled',o.enabled,'isDefault',o.is_default) order by o.position,o.id),'[]') from public.cafe_options o where o.org_id=org and o.group_id=g.id and o.deleted_at is null)) order by g.name,g.id),'[]') into groups
 from public.cafe_option_groups g where g.org_id=org and g.deleted_at is null and (p_management or (mode in ('CAFE','RESTAURANT') and g.enabled));
 return jsonb_build_object('storeMode',mode,'groups',groups);
end;$$;

create or replace function public.manage_cafe_product(p_operation text,p_id uuid,p_barcode text,p_name text,p_category_id uuid,
 p_sale_price numeric,p_unit_cost numeric,p_expected_version bigint,p_request_id uuid,p_quantity integer,p_group_ids uuid[],p_group_versions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;result jsonb;pid uuid;old_ids uuid[];next_ids uuid[];v jsonb;
begin
 org=private.coupon_org(array['OWNER'],false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null for share;
 if coalesce(mode,'') not in ('CAFE','RESTAURANT') then raise sqlstate 'PT409' using message='CAFE_MODE_REQUIRED';end if;
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
 if exists(select 1 from unnest(next_ids) g where (select count(*) from public.cafe_product_groups a where a.org_id=org and a.group_id=g and a.product_id<>pid)>=200) then raise sqlstate 'PT409' using message='OPTION_GROUP_PRODUCT_LIMIT';end if;
 delete from public.cafe_product_groups where org_id=org and product_id=pid;
 insert into public.cafe_product_groups(org_id,product_id,group_id) select org,pid,x from unnest(next_ids) x;
 update public.cafe_option_groups set row_version=row_version+1 where org_id=org and (id=any(old_ids) or id=any(next_ids));
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_PRODUCT_OPTIONS_SAVED',pid,p_request_id);
 end if;
 return result;
end;$$;

create or replace function private.quote_cafe_options(p_items jsonb,p_discount text,p_coupon_code text,p_captured boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;item jsonb;rows jsonb='[]';aggregated jsonb;base jsonb;p public.products;g public.cafe_option_groups;opts jsonb;snapshot jsonb;ids jsonb;cfg jsonb;choice_count int;matched int;
 qty integer;unit numeric;subtotal numeric=0;discount numeric;coupon_discount numeric=0;total numeric;vat numeric;note text;line_id text;c public.coupons;fingerprint text;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null;
 if coalesce(mode,'') not in ('CAFE','RESTAURANT') and not p_captured then raise sqlstate 'PT409' using message='CAFE_MODE_REQUIRED';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 or p_discount is null or p_discount!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 for item in select value from jsonb_array_elements(p_items) loop
 if jsonb_typeof(item)<>'object' or (item-array['productId','quantity','lineId','optionIds','note','expectedUnitPrice','expectedVersion','expectedOptionsFingerprint','cafeSnapshot'])<>'{}'::jsonb
 or coalesce(item->>'productId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(item->'quantity')<>'number' or coalesce(item->>'quantity','')!~'^[1-9][0-9]{0,9}$' or (item->>'quantity')::numeric>2147483647
 or (item?'lineId' and coalesce(item->>'lineId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 or (item?'note' and (jsonb_typeof(item->'note')<>'string' or char_length(item->>'note')>200)) or (item?'cafeSnapshot' and not p_captured) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 ids=coalesce(item->'optionIds','[]');if jsonb_typeof(ids)<>'array' or jsonb_array_length(ids)>100 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if exists(select 1 from jsonb_array_elements(ids) v where jsonb_typeof(v)<>'string' or trim(both '"' from v::text)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or (select count(distinct value) from jsonb_array_elements_text(ids))<>jsonb_array_length(ids) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 end loop;
 if (select count(distinct coalesce(value->>'lineId',value->>'productId')) from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise sqlstate 'PT400' using message='DUPLICATE_LINE';end if;
 if exists(select 1 from jsonb_array_elements(p_items) v group by v->>'productId' having sum((v->>'quantity')::numeric)>2147483647) then raise sqlstate 'PT409' using message='INSUFFICIENT_STOCK';end if;
 select jsonb_agg(jsonb_build_object('productId',id,'quantity',q) order by id) into aggregated from(select value->>'productId' id,sum((value->>'quantity')::int)::int q from jsonb_array_elements(p_items) group by value->>'productId')t;
 base=private.quote_stock_policy(aggregated,'0.00',true);
 perform pg_advisory_xact_lock_shared(hashtextextended(org::text||':cafe-config',0));
 for item in select value from jsonb_array_elements(p_items) loop
 select * into p from public.products where org_id=org and id=(item->>'productId')::uuid and deleted_at is null;
 qty=(item->>'quantity')::int;ids=coalesce(item->'optionIds','[]');note=btrim(coalesce(item->>'note',''));line_id=coalesce(item->>'lineId',item->>'productId');
 if p_captured and item?'cafeSnapshot' then
  snapshot=item->'cafeSnapshot';opts=snapshot->'options';unit=(snapshot->>'baseUnitPrice')::numeric+coalesce((select sum((value->>'price')::numeric) from jsonb_array_elements(opts)),0);
 else
  matched=0;cfg='[]';
  for g in select x.* from public.cafe_option_groups x join public.cafe_product_groups a on a.org_id=x.org_id and a.group_id=x.id where x.org_id=org and a.product_id=p.id and x.enabled and x.deleted_at is null order by x.id loop
   select count(*) into choice_count from public.cafe_options o where o.org_id=org and o.group_id=g.id and o.enabled and o.deleted_at is null and o.id in(select value::uuid from jsonb_array_elements_text(ids));
   if choice_count<g.min_choices or choice_count>g.max_choices then raise sqlstate 'PT409' using message='OPTION_SELECTION_REQUIRED';end if;
   matched=matched+choice_count;cfg=cfg||jsonb_build_array(jsonb_build_object('id',g.id,'version',g.row_version));
  end loop;
  if matched<>jsonb_array_length(ids) then raise sqlstate 'PT409' using message='OPTION_UNAVAILABLE';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'groupName',og.name,'price',o.price::text) order by og.id,o.position,o.id),'[]') into opts from public.cafe_options o join public.cafe_option_groups og on og.org_id=o.org_id and og.id=o.group_id where o.org_id=org and o.id in(select value::uuid from jsonb_array_elements_text(ids)) and o.deleted_at is null and o.enabled;
  unit=p.sale_price+coalesce((select sum((value->>'price')::numeric) from jsonb_array_elements(opts)),0);
  snapshot=jsonb_build_object('baseUnitPrice',p.sale_price::text,'options',opts,'configuration',cfg);
 end if;
 if unit>999999999999.99 or unit*qty>999999999999.99 then raise sqlstate 'PT400' using message='AMOUNT_OUT_OF_RANGE';end if;
 fingerprint=md5(snapshot::text);subtotal=subtotal+unit*qty;
 rows=rows||jsonb_build_array(jsonb_build_object('productId',p.id,'lineId',line_id,'barcode',p.barcode,'name',p.name,'quantity',qty,'unitPrice',unit::numeric(14,2)::text,'baseUnitPrice',snapshot->>'baseUnitPrice','expectedVersion',p.row_version,'stockAvailable',p.quantity_on_hand,'lineTotal',(unit*qty)::numeric(14,2)::text,'optionIds',ids,'options',opts,'note',note,'optionsFingerprint',fingerprint,'cafeSnapshot',snapshot));
 end loop;
 if subtotal>999999999999.99 then raise sqlstate 'PT400' using message='AMOUNT_OUT_OF_RANGE';end if;
 discount=p_discount::numeric;if discount>subtotal then raise sqlstate 'PT400' using message='INVALID_DISCOUNT';end if;
 if p_coupon_code is not null then
  perform private.coupon_org(array['OWNER','EMPLOYEE']);
  select * into c from public.coupons where org_id=org and code=p_coupon_code and deleted_at is null;
  if not found or (now() at time zone 'Asia/Bangkok')::date<c.starts_on or (now() at time zone 'Asia/Bangkok')::date>c.ends_on or c.used_count>=c.max_uses then raise sqlstate 'PT409' using message='COUPON_UNAVAILABLE';end if;
  coupon_discount=least(c.amount,subtotal-discount);if coupon_discount<=0 then raise sqlstate 'PT409' using message='COUPON_NO_DISCOUNT';end if;
 end if;
 total=subtotal-discount-coupon_discount;vat=case when (base->>'vatEnabled')::boolean then round(total*(base->>'vatRate')::numeric/(100+(base->>'vatRate')::numeric),2) else 0 end;
 base=base||jsonb_build_object('items',rows,'subtotalAmount',subtotal::numeric(14,2)::text,'discountAmount',(discount+coupon_discount)::numeric(14,2)::text,'manualDiscountAmount',p_discount,'couponDiscountAmount',coupon_discount::numeric(14,2)::text,'totalAmount',total::numeric(14,2)::text,'vatAmount',vat::numeric(14,2)::text);
 return base||jsonb_build_object('quoteFingerprint',md5(org::text||base::text));
end;$$;

create or replace function public.list_pos_products(p_page integer default 1,p_limit integer default 10,
 p_search text default '',p_barcode text default null,p_category_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_where text=' from public.products where org_id=$1 and deleted_at is null';
 v_pattern text;v_total bigint;v_rows jsonb;v_cafe boolean;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE'
 and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 100
 or p_search is null or char_length(p_search)>200 or (p_barcode is not null and char_length(p_barcode) not between 1 and 100)
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select store_mode in ('CAFE','RESTAURANT') into v_cafe from public.store_settings where org_id=v_org and deleted_at is null;
 if p_category_id is not null then v_where=v_where||' and category_id=$2';end if;
 if p_barcode is not null then v_where=v_where||' and barcode=$3';end if;
 if p_search<>'' then
 -- LIKE retains literal substring semantics, including %, _ and backslash.
 v_pattern='%'||replace(replace(replace(lower(p_search),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
 v_where=v_where||' and (lower(name) like $4 or lower(barcode) like $4)';
 end if;
 execute 'select count(*)'||v_where into v_total using v_org,p_category_id,p_barcode,v_pattern;
 execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''barcode'',barcode,''categoryId'',category_id,''salePrice'',sale_price::text,''quantityOnHand'',quantity_on_hand,''rowVersion'',row_version,''imageUrl'',null,''imagePath'',coalesce(image_thumbnail_path,image_path)) || case when $7 and not track_stock then jsonb_build_object(''trackStock'',false) else ''{}''::jsonb end order by name,id),''[]''::jsonb) from (select id,name,barcode,category_id,sale_price,track_stock,quantity_on_hand,row_version,image_path,image_thumbnail_path'||v_where||' order by name,id offset $5 limit $6) paged'
 into v_rows using v_org,p_category_id,p_barcode,v_pattern,(p_page-1)*p_limit,p_limit,coalesce(v_cafe,false);
 return jsonb_build_object('items',v_rows,'total',v_total,'page',p_page,'limit',p_limit);
end;$$;

create table public.restaurant_tables(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations,
 name text not null check(char_length(name) between 1 and 60),zone text not null default '' check(char_length(zone)<=60),
 seats integer not null check(seats between 1 and 100),enabled boolean not null default true,version bigint not null default 1,
 unique(org_id,id),unique(org_id,name)
);
create table public.restaurant_bills(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations,
 table_id uuid not null,table_name text not null,status text not null default 'OPEN' check(status in ('OPEN','CLOSED','CANCELLED')),
 version bigint not null default 1,opened_at timestamptz not null default now(),opened_by uuid not null references auth.users,
 open_key uuid not null,sale_id uuid,checkout_key uuid,checkout_input jsonb,result_json jsonb,
 closed_at timestamptz,unique(org_id,id),unique(org_id,open_key),unique(org_id,checkout_key),
 foreign key(org_id,table_id) references public.restaurant_tables(org_id,id),foreign key(org_id,sale_id) references public.sales(org_id,id)
);
create unique index restaurant_one_open_bill on public.restaurant_bills(org_id,table_id) where status='OPEN';
create table public.restaurant_rounds(
 id uuid primary key,org_id uuid not null,bill_id uuid not null,number integer not null,
 input_json jsonb not null,items jsonb not null,created_at timestamptz not null default now(),created_by uuid not null references auth.users,
 cancelled_at timestamptz,cancel_reason text check(char_length(cancel_reason) between 1 and 200),
 unique(org_id,bill_id,number),foreign key(org_id,bill_id) references public.restaurant_bills(org_id,id)
);
create index restaurant_open_bills on public.restaurant_bills(org_id,status);
create index restaurant_bill_rounds on public.restaurant_rounds(org_id,bill_id);
alter table public.restaurant_tables enable row level security;
alter table public.restaurant_bills enable row level security;
alter table public.restaurant_rounds enable row level security;
revoke all on public.restaurant_tables,public.restaurant_bills,public.restaurant_rounds from public,anon,authenticated;
grant select on public.restaurant_tables,public.restaurant_bills,public.restaurant_rounds to authenticated;
create policy restaurant_tables_read on public.restaurant_tables for select to authenticated using(private.current_org_role(org_id) in ('OWNER','EMPLOYEE'));
create policy restaurant_bills_read on public.restaurant_bills for select to authenticated using(private.current_org_role(org_id) in ('OWNER','EMPLOYEE'));
create policy restaurant_rounds_read on public.restaurant_rounds for select to authenticated using(private.current_org_role(org_id) in ('OWNER','EMPLOYEE'));

-- Lock order: settings -> per-org operations -> bill -> products. Mode changes serialize with all operations.
create function private.restaurant_org(p_owner boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;
begin
 org=private.coupon_org(case when p_owner then array['OWNER'] else array['OWNER','EMPLOYEE'] end,false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null for share;
 if mode is distinct from 'RESTAURANT' then raise sqlstate 'PT409' using message='RESTAURANT_MODE_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':restaurant',0));
 return org;
end;$$;
create function private.restaurant_mode_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.store_mode<>old.store_mode and exists(select 1 from public.restaurant_bills where org_id=new.org_id and status='OPEN') then
 raise sqlstate 'PT409' using message='OPEN_RESTAURANT_BILLS';end if;return new;
end;$$;
create trigger restaurant_mode_guard before update of store_mode on public.store_settings for each row execute function private.restaurant_mode_guard();
create function private.restaurant_product_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is not null and old.deleted_at is null and exists(
 select 1 from public.restaurant_rounds r join public.restaurant_bills b on b.org_id=r.org_id and b.id=r.bill_id,
 lateral jsonb_array_elements(r.items) i where r.org_id=new.org_id and b.status='OPEN' and r.cancelled_at is null and i->>'productId'=new.id::text
 ) then raise sqlstate 'PT409' using message='OPEN_RESTAURANT_ORDERS';end if;return new;
end;$$;
create trigger restaurant_product_guard before update of deleted_at on public.products for each row execute function private.restaurant_product_guard();

create function private.restaurant_bill_json(p_org uuid,p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'tableId',b.table_id,'tableName',b.table_name,'status',b.status,'version',b.version,'openedAt',b.opened_at,
 'rounds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'number',r.number,'createdAt',r.created_at,'items',r.items,'cancelled',r.cancelled_at is not null,'cancelReason',r.cancel_reason) order by r.number) from public.restaurant_rounds r where r.org_id=b.org_id and r.bill_id=b.id),'[]'),
 'totalAmount',coalesce((select sum((i->>'lineTotal')::numeric) from public.restaurant_rounds r,lateral jsonb_array_elements(r.items) i where r.org_id=b.org_id and r.bill_id=b.id and r.cancelled_at is null),0)::numeric(14,2)::text)
 from public.restaurant_bills b where b.org_id=p_org and b.id=p_id;
$$;
create function public.restaurant_board() returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org=private.restaurant_org();
 return jsonb_build_object('tables',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'zone',t.zone,'seats',t.seats,'enabled',t.enabled,'version',t.version,
 'bill',(select private.restaurant_bill_json(org,b.id) from public.restaurant_bills b where b.org_id=org and b.table_id=t.id and b.status='OPEN')) order by t.zone,t.name) from public.restaurant_tables t where t.org_id=org),'[]'));
end;$$;
create function public.restaurant_save_table(p_id uuid,p_input jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;t public.restaurant_tables;
begin
 org=private.restaurant_org(true);
 if p_request is null or p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['name','zone','seats','enabled','version'])<>'{}' or not(p_input ?& array['name','zone','seats','enabled'])
 or jsonb_typeof(p_input->'name')<>'string' or char_length(btrim(p_input->>'name')) not between 1 and 60
 or jsonb_typeof(p_input->'zone')<>'string' or char_length(p_input->>'zone')>60 or jsonb_typeof(p_input->'enabled')<>'boolean'
 or jsonb_typeof(p_input->'seats')<>'number' or coalesce(p_input->>'seats','')!~'^[1-9][0-9]{0,2}$' or (p_input->>'seats')::int>100 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_id is null then
 if (select count(*) from public.restaurant_tables where org_id=org)>=100 then raise sqlstate 'PT409' using message='TABLE_LIMIT';end if;
 insert into public.restaurant_tables(org_id,name,zone,seats,enabled) values(org,btrim(p_input->>'name'),btrim(p_input->>'zone'),(p_input->>'seats')::int,(p_input->>'enabled')::boolean) returning * into t;
 else
 select * into t from public.restaurant_tables where org_id=org and id=p_id for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if coalesce(p_input->>'version','')!~'^[1-9][0-9]{0,15}$' or t.version<>(p_input->>'version')::bigint then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 if exists(select 1 from public.restaurant_bills where org_id=org and table_id=p_id and status='OPEN') then raise sqlstate 'PT409' using message='TABLE_IN_USE';end if;
 update public.restaurant_tables set name=btrim(p_input->>'name'),zone=btrim(p_input->>'zone'),seats=(p_input->>'seats')::int,enabled=(p_input->>'enabled')::boolean,version=version+1 where org_id=org and id=p_id returning * into t;
 end if;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_TABLE_SAVED',t.id,p_request);
 return jsonb_build_object('id',t.id);
 exception when unique_violation then raise sqlstate 'PT409' using message='TABLE_NAME_EXISTS';
end;$$;
create function public.restaurant_open_bill(p_table uuid,p_key uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;t public.restaurant_tables;b public.restaurant_bills;
begin
 org=private.restaurant_org();
 if p_key is null or p_request is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into b from public.restaurant_bills where org_id=org and open_key=p_key;
 if found then if b.table_id<>p_table then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;return private.restaurant_bill_json(org,b.id);end if;
 select * into t from public.restaurant_tables where org_id=org and id=p_table and enabled for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 select * into b from public.restaurant_bills where org_id=org and table_id=p_table and status='OPEN';
 if found then return private.restaurant_bill_json(org,b.id);end if;
 insert into public.restaurant_bills(org_id,table_id,table_name,opened_by,open_key) values(org,p_table,t.name,auth.uid(),p_key) returning * into b;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_BILL_OPENED',b.id,p_request);
 return private.restaurant_bill_json(org,b.id);
end;$$;
create function public.restaurant_send_round(p_bill uuid,p_version bigint,p_items jsonb,p_key uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;r public.restaurant_rounds;q jsonb;n integer;
begin
 org=private.restaurant_org();
 if p_key is null or p_request is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 select * into r from public.restaurant_rounds where id=p_key;
 if found then if r.org_id<>org or r.bill_id<>p_bill or r.input_json<>jsonb_build_object('items',p_items,'actor',auth.uid()) then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;return private.restaurant_bill_json(org,b.id);end if;
 if b.status<>'OPEN' or p_version is null or b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 -- Price/option snapshots come from the server; never trust browser totals.
 q=private.quote_cafe_options(p_items,'0.00',null,false);
 if exists(select 1 from jsonb_array_elements(p_items) i join jsonb_array_elements(q->'items') x on x->>'lineId'=coalesce(i->>'lineId',i->>'productId')
 where coalesce(i->>'expectedUnitPrice','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' or i->>'expectedUnitPrice'<>x->>'unitPrice') then raise sqlstate 'PT409' using message='CART_STALE';end if;
 if (private.restaurant_bill_json(org,b.id)->>'totalAmount')::numeric+(q->>'totalAmount')::numeric>999999999999.99 then raise sqlstate 'PT400' using message='AMOUNT_OUT_OF_RANGE';end if;
 perform 1 from public.products p where p.org_id=org and p.id in(select (i->>'productId')::uuid from jsonb_array_elements(q->'items') i) order by p.id for update;
 if exists(select 1 from public.products p where p.org_id=org and p.deleted_at is not null and p.id in(select (i->>'productId')::uuid from jsonb_array_elements(q->'items') i)) then raise sqlstate 'PT409' using message='PRODUCT_UNAVAILABLE';end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.restaurant_rounds where org_id=org and bill_id=b.id and cancelled_at is null)+jsonb_array_length(p_items)>200 then raise sqlstate 'PT409' using message='ORDER_LIMIT';end if;
 select coalesce(max(number),0)+1 into n from public.restaurant_rounds where org_id=org and bill_id=b.id;
 if n>200 then raise sqlstate 'PT409' using message='ORDER_LIMIT';end if;
 insert into public.restaurant_rounds(id,org_id,bill_id,number,input_json,items,created_by) values(p_key,org,b.id,n,jsonb_build_object('items',p_items,'actor',auth.uid()),(select jsonb_agg(i||jsonb_build_object('lineId',gen_random_uuid())) from jsonb_array_elements(q->'items') i),auth.uid());
 update public.restaurant_bills set version=version+1 where org_id=org and id=b.id;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_ROUND_SENT',p_key,p_request);
 return private.restaurant_bill_json(org,b.id);
end;$$;
create function public.restaurant_cancel_round(p_bill uuid,p_round uuid,p_version bigint,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;
begin
 org=private.restaurant_org(true);
 if p_request is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 200 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if b.status<>'OPEN' then raise sqlstate 'PT409' using message='BILL_CLOSED';end if;
 if exists(select 1 from public.restaurant_rounds where org_id=org and bill_id=p_bill and id=p_round and cancelled_at is not null) then return private.restaurant_bill_json(org,p_bill);end if;
 if p_version is null or b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.restaurant_rounds set cancelled_at=now(),cancel_reason=btrim(p_reason) where org_id=org and bill_id=p_bill and id=p_round;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 update public.restaurant_bills set version=version+1 where org_id=org and id=p_bill;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_ROUND_CANCELLED',p_round,p_request);
 return private.restaurant_bill_json(org,p_bill);
end;$$;
create function public.restaurant_cancel_bill(p_bill uuid,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;
begin
 org=private.restaurant_org();
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if b.status='CANCELLED' then return private.restaurant_bill_json(org,p_bill);end if;
 if p_request is null or b.status<>'OPEN' or p_version is null or b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 if exists(select 1 from public.restaurant_rounds where org_id=org and bill_id=p_bill and cancelled_at is null) then raise sqlstate 'PT409' using message='BILL_HAS_ORDERS';end if;
 update public.restaurant_bills set status='CANCELLED',closed_at=now(),version=version+1 where org_id=org and id=p_bill;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_BILL_CANCELLED',p_bill,p_request);
 return private.restaurant_bill_json(org,p_bill);
end;$$;
create function public.restaurant_checkout_cash(p_bill uuid,p_version bigint,p_received text,p_total text,p_key uuid,p_request uuid,p_identity_cipher text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;items jsonb;q jsonb;input jsonb;result jsonb;row jsonb;sid uuid;
begin
 org=private.restaurant_org();
 if p_key is null or p_request is null or p_received is null or p_received!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 or p_total is null or p_total!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 input=jsonb_build_object('version',p_version,'received',p_received,'total',p_total,'actor',auth.uid());
 if b.status='CLOSED' then
 if b.checkout_key is distinct from p_key or b.checkout_input is distinct from input then raise sqlstate 'PT409' using message='BILL_CLOSED';end if;
 return b.result_json||jsonb_build_object('replayed',true);
 end if;
 if b.status<>'OPEN' or p_version is null or b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 select coalesce(jsonb_agg(i order by r.number,ordinality),'[]') into items from public.restaurant_rounds r,
 lateral jsonb_array_elements(r.items) with ordinality a(i,ordinality) where r.org_id=org and r.bill_id=p_bill and r.cancelled_at is null;
 if jsonb_array_length(items)=0 then raise sqlstate 'PT409' using message='EMPTY_BILL';end if;
 -- Only private, server-stored snapshots can reach captured-price settlement.
 -- The existing atomic sale routine owns stock, payment, coupon and audit ledgers.
 perform 1 from public.products p where p.org_id=org and p.id in(select (i->>'productId')::uuid from jsonb_array_elements(items) i) order by p.id for update;
 select jsonb_agg(jsonb_build_object('productId',i->>'productId','lineId',i->>'lineId','optionIds',i->'optionIds','note',i->>'note','quantity',(i->>'quantity')::int,
 'cafeSnapshot',i->'cafeSnapshot','expectedUnitPrice',i->>'unitPrice','expectedVersion',p.row_version)) into q
 from jsonb_array_elements(items) i join public.products p on p.org_id=org and p.id=(i->>'productId')::uuid;
 if p_total<>(select sum((i->>'lineTotal')::numeric)::numeric(14,2)::text from jsonb_array_elements(items) i) then raise sqlstate 'PT409' using message='CART_STALE';end if;
 result=private.checkout_cafe_options(jsonb_build_object('items',q,'discountAmount','0.00','expectedTotalAmount',p_total,'payment',jsonb_build_object('method','CASH','receivedAmount',p_received)),p_key,p_request,p_identity_cipher,true);
 sid=(result->>'saleId')::uuid;
 -- Restore the confirmed menu names/barcodes even if the owner renamed the live menu meanwhile.
 for row in select i from jsonb_array_elements(items) i loop
 update public.sale_items set product_name_snapshot=row->>'name',barcode_snapshot=row->>'barcode' where org_id=org and sale_id=sid and cafe_line_id=(row->>'lineId')::uuid;
 end loop;
 select jsonb_agg(r||jsonb_build_object('productName',i->>'name','barcode',i->>'barcode') order by n) into q
 from jsonb_array_elements(result->'receipt'->'items') with ordinality x(r,n) join jsonb_array_elements(items) i on i->>'lineId'=r->>'lineId';
 result=jsonb_set(result,'{receipt,items}',q);
 result=jsonb_set(result,'{receipt,restaurant}',jsonb_build_object('billId',b.id,'tableName',b.table_name));
 update public.sales set result_json=result-'replayed' where org_id=org and id=sid;
 update public.restaurant_bills set status='CLOSED',closed_at=now(),version=version+1,sale_id=sid,checkout_key=p_key,checkout_input=input,result_json=result-'replayed' where org_id=org and id=b.id;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_BILL_SETTLED',b.id,p_request);
 return result;
end;$$;

-- RPC-only writes. Private helpers and triggers never have public execution privileges.
revoke all on function private.restaurant_org(boolean),private.restaurant_bill_json(uuid,uuid),private.restaurant_mode_guard(),private.restaurant_product_guard() from public,anon,authenticated,service_role;
revoke all on function public.restaurant_board(),public.restaurant_save_table(uuid,jsonb,uuid),public.restaurant_open_bill(uuid,uuid,uuid),public.restaurant_send_round(uuid,bigint,jsonb,uuid,uuid),public.restaurant_cancel_round(uuid,uuid,bigint,text,uuid),public.restaurant_cancel_bill(uuid,bigint,uuid),public.restaurant_checkout_cash(uuid,bigint,text,text,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.restaurant_board(),public.restaurant_save_table(uuid,jsonb,uuid),public.restaurant_open_bill(uuid,uuid,uuid),public.restaurant_send_round(uuid,bigint,jsonb,uuid,uuid),public.restaurant_cancel_round(uuid,uuid,bigint,text,uuid),public.restaurant_cancel_bill(uuid,bigint,uuid),public.restaurant_checkout_cash(uuid,bigint,text,text,uuid,uuid,text) to authenticated;
create or replace function public.report_data(p_type text,p_from timestamptz,p_to timestamptz,p_group text default 'day',p_cashier uuid default null,p_page integer default 1,p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_rows jsonb;v_summary jsonb;v_count bigint;v_cost numeric;v_revenue numeric;v_financial jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id) in ('OWNER','ACCOUNTANT');
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_type is null or p_type not in ('sales','inventory','low-stock','stock-valuation') or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 10000 or p_group is null or p_group not in ('day','week','month','year') then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_type='sales' then
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise sqlstate 'PT400' using message='INVALID_DATE_RANGE';end if;
 select jsonb_build_object('gross',coalesce(sum(subtotal_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'discount',coalesce(sum(discount_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'net',coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'vat',coalesce(sum(vat_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'billCount',count(*) filter(where status='COMPLETED'),'voidCount',count(*) filter(where status='VOIDED'),'voidAmount',coalesce(sum(total_amount) filter(where status='VOIDED'),0)::numeric(20,2)::text)
 into v_summary from public.sales where org_id=v_org and completed_at>=p_from and completed_at<p_to and (p_cashier is null or cashier_id=p_cashier);
 -- Historical COGS uses immutable sale-item costs, never current inventory valuation.
 select coalesce(sum(i.quantity::numeric*i.unit_cost),0) into v_cost
 from public.sale_items i join public.sales s on s.id=i.sale_id and s.org_id=i.org_id
 where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=p_from and s.completed_at<p_to
 and (p_cashier is null or s.cashier_id=p_cashier);
 v_revenue=(v_summary->>'net')::numeric-(v_summary->>'vat')::numeric;
 v_financial=jsonb_build_object('netSalesExVat',v_revenue::numeric(24,2)::text,
 'cogs',v_cost::numeric(24,2)::text,'grossProfit',(v_revenue-v_cost)::numeric(24,2)::text,
 'grossMarginPercent',case when v_revenue=0 then null else (100*(v_revenue-v_cost)/v_revenue)::numeric(24,2)::text end);

 with groups as(select date_trunc(p_group,completed_at at time zone 'Asia/Bangkok') as period,
 coalesce(sum(subtotal_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as gross,coalesce(sum(discount_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as discount,coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as net,coalesce(sum(vat_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as vat,count(*) filter(where status='COMPLETED') as "billCount",count(*) filter(where status='VOIDED') as "voidCount",coalesce(sum(total_amount) filter(where status='VOIDED'),0)::numeric(20,2)::text as "voidAmount"
 from public.sales where org_id=v_org and completed_at>=p_from and completed_at<p_to and (p_cashier is null or cashier_id=p_cashier) group by 1)
 select count(*),coalesce((select jsonb_agg(to_jsonb(t)) from(select to_char(period,'YYYY-MM-DD') as period,gross,discount,net,vat,"billCount","voidCount","voidAmount" from groups order by period desc limit p_limit offset (p_page-1)*p_limit)t),'[]'::jsonb) into v_count,v_rows from groups;
 else
 select count(*),jsonb_build_object('productCount',count(*),'quantity',coalesce(sum(quantity_on_hand::bigint),0),'valuation',coalesce(sum(quantity_on_hand::numeric*unit_cost),0)::numeric(24,2)::text) into v_count,v_summary from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5 and (track_stock or coalesce((select store_mode not in ('CAFE','RESTAURANT') from public.store_settings where org_id=v_org and deleted_at is null),true)));
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_rows from(select id,barcode,name,quantity_on_hand as quantity,unit_cost::text as "unitCost",sale_price::text as "salePrice",(quantity_on_hand::numeric*unit_cost)::numeric(24,2)::text as valuation from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5 and (track_stock or coalesce((select store_mode not in ('CAFE','RESTAURANT') from public.store_settings where org_id=v_org and deleted_at is null),true))) order by name,id limit p_limit offset(p_page-1)*p_limit)t;
 end if;
 return jsonb_build_object('type',p_type,'summary',v_summary,'items',v_rows,'total',v_count,'page',p_page,'limit',p_limit)||case when p_type='sales' then jsonb_build_object('financial',v_financial) else '{}'::jsonb end;
end;$$;

create or replace function public.dashboard_summary(p_include_top boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_today timestamptz;v_month timestamptz;v_next timestamptz;v_result jsonb;v_top jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id)='OWNER';
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 v_today=date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
 v_month=date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';v_next=(date_trunc('day',now() at time zone 'Asia/Bangkok')+interval '1 day') at time zone 'Asia/Bangkok';
 select jsonb_build_object('todaySales',coalesce(sum(total_amount) filter(where status='COMPLETED' and completed_at>=v_today),0)::numeric(20,2)::text,'monthSales',coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'todayBills',count(*) filter(where status='COMPLETED' and completed_at>=v_today),'todayVoids',count(*) filter(where status='VOIDED' and completed_at>=v_today)) into v_result from public.sales where org_id=v_org and completed_at>=v_month and completed_at<v_next;
 v_result=v_result||jsonb_build_object('lowStockCount',(select count(*) from public.products where org_id=v_org and deleted_at is null and quantity_on_hand<=5 and (track_stock or coalesce((select store_mode not in ('CAFE','RESTAURANT') from public.store_settings where org_id=v_org and deleted_at is null),true))),'dateBangkok',to_char(v_today at time zone 'Asia/Bangkok','YYYY-MM-DD'));
 v_result=v_result||jsonb_build_object('cashToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='CASH'),0)::numeric(20,2)::text,'promptpayToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='PROMPTPAY'),0)::numeric(20,2)::text);
 v_top='[]'::jsonb;
 if p_include_top then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_top from(select i.product_id as "productId",(array_agg(i.product_name_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as name,(array_agg(i.barcode_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as barcode,sum(i.quantity::bigint) as quantity,sum(i.line_total)::numeric(20,2)::text as net from public.sale_items i join public.sales s on s.org_id=i.org_id and s.id=i.sale_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_month and s.completed_at<v_next group by i.product_id order by sum(i.quantity::bigint) desc,i.product_id limit 5)t;
 end if;
 return v_result||jsonb_build_object('topProducts',v_top);
end;$$;
notify pgrst,'reload schema';

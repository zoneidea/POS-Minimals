-- Optional cafe modifiers; legacy retail SQL and payloads keep their existing path.
create table public.cafe_option_groups(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),
 name text not null check(char_length(btrim(name)) between 1 and 80),min_choices integer not null check(min_choices between 0 and 20),max_choices integer not null check(max_choices between 1 and 20 and max_choices>=min_choices),
 enabled boolean not null default true,row_version bigint not null default 1,deleted_at timestamptz,
 unique(org_id,id)
);
create table public.cafe_options(
 id uuid primary key,org_id uuid not null,group_id uuid not null,name text not null check(char_length(btrim(name)) between 1 and 80),
 price numeric(14,2) not null check(price>=0),enabled boolean not null,is_default boolean not null,position integer not null,deleted_at timestamptz,
 foreign key(org_id,group_id) references public.cafe_option_groups(org_id,id),unique(org_id,id)
);
create index cafe_options_group on public.cafe_options(org_id,group_id,position) where deleted_at is null;
create table public.cafe_product_groups(
 org_id uuid not null,product_id uuid not null,group_id uuid not null,
 primary key(org_id,product_id,group_id),foreign key(org_id,product_id) references public.products(org_id,id),foreign key(org_id,group_id) references public.cafe_option_groups(org_id,id)
);
create index cafe_groups_assignment on public.cafe_product_groups(org_id,group_id);
alter table public.cafe_option_groups enable row level security;alter table public.cafe_options enable row level security;alter table public.cafe_product_groups enable row level security;
revoke all on public.cafe_option_groups,public.cafe_options,public.cafe_product_groups from public,anon,authenticated;
grant select on public.cafe_option_groups,public.cafe_options,public.cafe_product_groups to authenticated;
create policy cafe_groups_owner on public.cafe_option_groups for select to authenticated using(private.current_org_role(org_id)='OWNER');
create policy cafe_options_owner on public.cafe_options for select to authenticated using(private.current_org_role(org_id)='OWNER');
create policy cafe_assignments_owner on public.cafe_product_groups for select to authenticated using(private.current_org_role(org_id)='OWNER');
alter table public.sale_items add column cafe_options jsonb not null default '[]',add column cafe_note text not null default '' check(char_length(cafe_note)<=200),add column cafe_line_id uuid;

create function public.cafe_option_configuration(p_management boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;groups jsonb;
begin
 org=private.coupon_org(case when p_management then array['OWNER'] else array['OWNER','EMPLOYEE','ACCOUNTANT'] end,false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'minChoices',g.min_choices,'maxChoices',g.max_choices,'enabled',g.enabled,'version',g.row_version,
 'productIds',(select coalesce(jsonb_agg(a.product_id order by a.product_id),'[]') from public.cafe_product_groups a join public.products ap on ap.org_id=a.org_id and ap.id=a.product_id and ap.deleted_at is null where a.org_id=org and a.group_id=g.id),
 'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price::text,'enabled',o.enabled,'isDefault',o.is_default) order by o.position,o.id),'[]') from public.cafe_options o where o.org_id=org and o.group_id=g.id and o.deleted_at is null)) order by g.name,g.id),'[]') into groups
 from public.cafe_option_groups g where g.org_id=org and g.deleted_at is null and (p_management or (mode='CAFE' and g.enabled));
 return jsonb_build_object('storeMode',mode,'groups',groups);
end;$$;
create function public.save_cafe_option_group(p_id uuid,p_input jsonb,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;g public.cafe_option_groups;o jsonb;i integer=0;defaults integer;available integer;
begin
 org=private.coupon_org(array['OWNER'],false);
 if p_request is null or p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['name','minChoices','maxChoices','enabled','options','productIds'])<>'{}'::jsonb or not(p_input ?& array['name','minChoices','maxChoices','enabled','options','productIds'])
 or jsonb_typeof(p_input->'name')<>'string' or char_length(btrim(p_input->>'name')) not between 1 and 80 or jsonb_typeof(p_input->'enabled')<>'boolean'
 or coalesce(p_input->>'minChoices','')!~'^(0|[1-9][0-9]?)$' or coalesce(p_input->>'maxChoices','')!~'^[1-9][0-9]?$' or (p_input->>'minChoices')::int>(p_input->>'maxChoices')::int or (p_input->>'maxChoices')::int>20
 or jsonb_typeof(p_input->'options')<>'array' or jsonb_array_length(p_input->'options') not between 1 and 30 or jsonb_typeof(p_input->'productIds')<>'array' or jsonb_array_length(p_input->'productIds')>200 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 for o in select value from jsonb_array_elements(p_input->'options') loop
 if jsonb_typeof(o)<>'object' or (o-array['id','name','price','enabled','isDefault'])<>'{}'::jsonb or not(o ?& array['id','name','price','enabled','isDefault']) or coalesce(o->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 or jsonb_typeof(o->'name')<>'string' or char_length(btrim(o->>'name')) not between 1 and 80 or coalesce(o->>'price','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' or jsonb_typeof(o->'enabled')<>'boolean' or jsonb_typeof(o->'isDefault')<>'boolean' or ((o->>'isDefault')::boolean and not(o->>'enabled')::boolean) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_input->'options'))<>jsonb_array_length(p_input->'options') then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 for o in select value from jsonb_array_elements(p_input->'productIds') loop
 if jsonb_typeof(o)<>'string' or trim(both '"' from o::text)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements_text(p_input->'productIds'))<>jsonb_array_length(p_input->'productIds') or (select count(*) from public.products p where p.org_id=org and p.deleted_at is null and p.id in(select value::uuid from jsonb_array_elements_text(p_input->'productIds')))<>jsonb_array_length(p_input->'productIds') then raise sqlstate 'PT400' using message='PRODUCT_UNAVAILABLE';end if;
 select count(*) filter(where (value->>'isDefault')::boolean),count(*) filter(where (value->>'enabled')::boolean) into defaults,available from jsonb_array_elements(p_input->'options');
 if defaults>(p_input->>'maxChoices')::int or ((p_input->>'enabled')::boolean and available<(p_input->>'minChoices')::int) then raise sqlstate 'PT400' using message='INVALID_OPTION_LIMIT';end if;
 -- Product FK locks precede configuration lock, matching checkout's product locking order.
 perform 1 from public.products p where p.org_id=org and (p.id in(select value::uuid from jsonb_array_elements_text(p_input->'productIds')) or p.id in(select product_id from public.cafe_product_groups where org_id=org and group_id=p_id)) order by p.id for key share;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':cafe-config',0));
 if p_id is null then
 if (select count(*) from public.cafe_option_groups where org_id=org and deleted_at is null)>=200 then raise sqlstate 'PT409' using message='OPTION_GROUP_LIMIT';end if;
 insert into public.cafe_option_groups(org_id,name,min_choices,max_choices,enabled) values(org,btrim(p_input->>'name'),(p_input->>'minChoices')::int,(p_input->>'maxChoices')::int,(p_input->>'enabled')::boolean) returning * into g;
 else
 select * into g from public.cafe_option_groups where org_id=org and id=p_id and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_version is null or p_version<>g.row_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.cafe_option_groups set name=btrim(p_input->>'name'),min_choices=(p_input->>'minChoices')::int,max_choices=(p_input->>'maxChoices')::int,enabled=(p_input->>'enabled')::boolean,row_version=row_version+1 where id=g.id returning * into g;
 end if;
 if exists(select 1 from public.cafe_options x where x.id in(select (value->>'id')::uuid from jsonb_array_elements(p_input->'options')) and (x.org_id<>org or x.group_id<>g.id or x.deleted_at is not null)) then raise sqlstate 'PT409' using message='OPTION_CONFLICT';end if;
 update public.cafe_options set deleted_at=now(),enabled=false where org_id=org and group_id=g.id and deleted_at is null and id not in(select (value->>'id')::uuid from jsonb_array_elements(p_input->'options'));
 for o in select value from jsonb_array_elements(p_input->'options') loop
 i=i+1;
 insert into public.cafe_options(id,org_id,group_id,name,price,enabled,is_default,position) values((o->>'id')::uuid,org,g.id,btrim(o->>'name'),(o->>'price')::numeric,(o->>'enabled')::boolean,(o->>'isDefault')::boolean,i)
 on conflict(id) do update set name=excluded.name,price=excluded.price,enabled=excluded.enabled,is_default=excluded.is_default,position=excluded.position where cafe_options.org_id=org and cafe_options.group_id=g.id and cafe_options.deleted_at is null;
 if not found then raise sqlstate 'PT409' using message='OPTION_CONFLICT';end if;
 end loop;
 delete from public.cafe_product_groups where org_id=org and group_id=g.id;
 insert into public.cafe_product_groups(org_id,group_id,product_id) select org,g.id,value::uuid from jsonb_array_elements_text(p_input->'productIds');
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_OPTIONS_SAVED',g.id,p_request);
 return jsonb_build_object('id',g.id,'version',g.row_version);
end;$$;
revoke all on function public.cafe_option_configuration(boolean),public.save_cafe_option_group(uuid,jsonb,bigint,uuid) from public,anon;
grant execute on function public.cafe_option_configuration(boolean),public.save_cafe_option_group(uuid,jsonb,bigint,uuid) to authenticated;

create function private.quote_cafe_options(p_items jsonb,p_discount text,p_coupon_code text,p_captured boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;item jsonb;rows jsonb='[]';aggregated jsonb;base jsonb;p public.products;g public.cafe_option_groups;opts jsonb;snapshot jsonb;ids jsonb;cfg jsonb;choice_count int;matched int;
 qty integer;unit numeric;subtotal numeric=0;discount numeric;coupon_discount numeric=0;total numeric;vat numeric;note text;line_id text;c public.coupons;fingerprint text;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null;
 if mode<>'CAFE' and not p_captured then raise sqlstate 'PT409' using message='CAFE_MODE_REQUIRED';end if;
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
 base=public.quote_cash_sale(aggregated,'0.00');
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
revoke all on function private.quote_cafe_options(jsonb,text,text,boolean) from public,anon,authenticated,service_role;
alter function public.quote_coupon_sale(jsonb,text,text) set schema private;
alter function private.quote_coupon_sale(jsonb,text,text) rename to quote_coupon_legacy;
revoke all on function private.quote_coupon_legacy(jsonb,text,text) from public,anon,authenticated,service_role;
create function public.quote_coupon_sale(p_items jsonb,p_discount text,p_coupon_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);select store_mode into mode from public.store_settings where org_id=org and deleted_at is null;
 if mode='CAFE' then return private.quote_cafe_options(p_items,p_discount,p_coupon_code,false);end if;
 return private.quote_coupon_legacy(p_items,p_discount,p_coupon_code);
end;$$;
revoke all on function public.quote_coupon_sale(jsonb,text,text) from public,anon;
grant execute on function public.quote_coupon_sale(jsonb,text,text) to authenticated;

create function private.checkout_cafe_options(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text,p_gateway boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;existing public.sales;input jsonb;item jsonb;q jsonb;row jsonb;p public.products;c public.coupons;sid uuid=gen_random_uuid();sale_no text;receipt_items jsonb='[]';result jsonb;offers jsonb;before jsonb;
 subtotal numeric;discount numeric;total numeric;received numeric;gross numeric=0;allocated numeric=0;line_discount numeric;unit numeric;qty integer;i integer=0;n integer;mode text;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 if p_key is null or p_request_id is null or p_identity_cipher is null or char_length(p_identity_cipher) not between 1 and 10000 or p_input is null or jsonb_typeof(p_input)<>'object'
 or (p_input-array['items','discountAmount','couponCode','expectedTotalAmount','payment'])<>'{}'::jsonb or not(p_input ?& array['items','discountAmount','expectedTotalAmount','payment'])
 or coalesce(p_input->>'expectedTotalAmount','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' or jsonb_typeof(p_input->'payment')<>'object' or ((p_input->'payment')-array['method','receivedAmount'])<>'{}'::jsonb
 or p_input->'payment'->>'method' is distinct from 'CASH' or coalesce(p_input->'payment'->>'receivedAmount','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 input=p_input||jsonb_build_object('actor',auth.uid());
 perform pg_advisory_xact_lock(hashtextextended(org::text||':sale:'||p_key::text,0));
 select * into existing from public.sales where org_id=org and request_key=p_key;
 if found then if existing.input_json<>input then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;return existing.result_json||jsonb_build_object('replayed',true);end if;
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null;
 if mode<>'CAFE' and not(p_gateway and exists(select 1 from jsonb_array_elements(p_input->'items') x where x?'cafeSnapshot')) then raise sqlstate 'PT409' using message='CAFE_MODE_REQUIRED';end if;
 if jsonb_typeof(p_input->'items')<>'array' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 -- Validate identifiers before casts and locks; direct authenticated RPC callers cannot bypass HTTP validation.
 if exists(select 1 from jsonb_array_elements(p_input->'items') x where coalesce(x->>'productId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 perform 1 from public.products x where x.org_id=org and x.id in(select (value->>'productId')::uuid from jsonb_array_elements(p_input->'items')) order by x.id for update;
 if p_input?'couponCode' then
 perform private.coupon_org(array['OWNER','EMPLOYEE']);select * into c from public.coupons where org_id=org and code=p_input->>'couponCode' and deleted_at is null for update;
 if not found then raise sqlstate 'PT409' using message='COUPON_UNAVAILABLE';end if;end if;
 q=private.quote_cafe_options(p_input->'items',p_input->>'discountAmount',p_input->>'couponCode',p_gateway);
 n=jsonb_array_length(p_input->'items');
 for item in select value from jsonb_array_elements(p_input->'items') loop
  select x into row from jsonb_array_elements(q->'items') x where x->>'lineId'=coalesce(item->>'lineId',item->>'productId');
  if coalesce(item->>'expectedUnitPrice','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' or coalesce(item->>'expectedVersion','')!~'^[1-9][0-9]{0,15}$' or jsonb_typeof(item->'expectedVersion')<>'number' or (item->>'expectedVersion')::numeric>9007199254740991 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
  if (item->>'expectedUnitPrice')::numeric<>(row->>'unitPrice')::numeric or (item->>'expectedVersion')::numeric<>(row->>'expectedVersion')::numeric or (item?'expectedOptionsFingerprint' and item->>'expectedOptionsFingerprint'<>row->>'optionsFingerprint') then raise sqlstate 'PT409' using message='CART_STALE';end if;
 end loop;
 subtotal=(q->>'subtotalAmount')::numeric;discount=(q->>'discountAmount')::numeric;total=(q->>'totalAmount')::numeric;received=(p_input->'payment'->>'receivedAmount')::numeric;
 if total<>(p_input->>'expectedTotalAmount')::numeric then raise sqlstate 'PT409' using message='CART_STALE';end if;
 if received<total then raise sqlstate 'PT400' using message='INSUFFICIENT_PAYMENT';end if;
 sale_no='B'||translate(rtrim(encode(uuid_send(sid),'base64'),'='),'+/','-_');
 insert into public.sales(id,org_id,sale_no,cashier_id,subtotal_amount,discount_amount,vat_amount,total_amount,request_key,request_id,input_json,result_json,identity_cipher)
 values(sid,org,sale_no,auth.uid(),subtotal,discount,(q->>'vatAmount')::numeric,total,p_key,p_request_id,input,'{}',p_identity_cipher);
 for row in select value from jsonb_array_elements(q->'items') loop
  select * into p from public.products where org_id=org and id=(row->>'productId')::uuid;
  qty=(row->>'quantity')::int;unit=(row->>'unitPrice')::numeric;i=i+1;gross=gross+unit*qty;
  line_discount=case when i=n then discount-allocated when subtotal=0 then 0 else trunc(discount*gross/subtotal,2)-allocated end;allocated=allocated+line_discount;
  insert into public.sale_items(org_id,sale_id,product_id,barcode_snapshot,product_name_snapshot,quantity,unit_price,unit_cost,discount_amount,line_total,cafe_options,cafe_note,cafe_line_id)
  values(org,sid,p.id,p.barcode,p.name,qty,unit,p.unit_cost,line_discount,unit*qty-line_discount,row->'options',row->>'note',(row->>'lineId')::uuid);
  receipt_items=receipt_items||jsonb_build_array(jsonb_build_object('barcode',p.barcode,'productName',p.name,'quantity',qty,'unitPrice',unit::numeric(14,2)::text,'discountAmount',line_discount::numeric(14,2)::text,'lineTotal',(unit*qty-line_discount)::numeric(14,2)::text,'lineId',row->>'lineId','baseUnitPrice',row->>'baseUnitPrice','options',row->'options','note',row->>'note'));
 end loop;
 -- Exactly one stock movement per product preserves existing void's once-only restock invariant.
 for row in select jsonb_build_object('productId',value->>'productId','quantity',sum((value->>'quantity')::int)) from jsonb_array_elements(q->'items') group by value->>'productId' order by value->>'productId' loop
  select * into p from public.products where org_id=org and id=(row->>'productId')::uuid;
  qty=(row->>'quantity')::int;before=private.product_json(p);
  update public.products set quantity_on_hand=quantity_on_hand-qty,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where org_id=org and id=p.id;
  insert into public.stock_movements(org_id,product_id,sale_id,movement_type,quantity_delta,quantity_before,quantity_after,product_name_snapshot,barcode_snapshot,reason,performed_by,request_id,request_key,input_json,result_json)
  values(org,p.id,sid,'SALE_OUT',-qty,p.quantity_on_hand,p.quantity_on_hand-qty,p.name,p.barcode,'ขายสินค้า '||sale_no,auth.uid(),p_request_id,gen_random_uuid(),input,jsonb_build_object('saleId',sid));
  insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,reason,request_id)
  select org,x.id,'SALE_OUT',before,private.product_json(x),p.row_version,x.row_version,auth.uid(),'ขายสินค้า '||sale_no,p_request_id from public.products x where x.org_id=org and x.id=p.id;
 end loop;
 insert into public.payments(org_id,sale_id,method,amount,received_amount,change_amount,confirmed_by) values(org,sid,'CASH',total,received,received-total,auth.uid());
 result=jsonb_build_object('saleId',sid,'saleNo',sale_no,'status','COMPLETED','totalAmount',total::numeric(14,2)::text,'receivedAmount',received::numeric(14,2)::text,'changeAmount',(received-total)::numeric(14,2)::text,'identityCipher',p_identity_cipher,
 'receipt',jsonb_build_object('receiptSchemaVersion',1,'saleId',sid,'saleNo',sale_no,'completedAtUtc',now(),'items',receipt_items,'totals',jsonb_build_object('subtotal',subtotal::numeric(14,2)::text,'discount',discount::numeric(14,2)::text,'vat',q->>'vatAmount','total',total::numeric(14,2)::text,'received',received::numeric(14,2)::text,'change',(received-total)::numeric(14,2)::text),'vatRate',q->>'vatRate','vatEnabled',q->'vatEnabled','paymentMethod','CASH','saleStatus','COMPLETED'));
 if c.id is not null then
 insert into public.coupon_redemptions(org_id,sale_id,coupon_id,code_snapshot,name_snapshot,discount_amount) values(org,sid,c.id,c.code,c.name,(q->>'couponDiscountAmount')::numeric);
 update public.coupons set used_count=used_count+1,row_version=row_version+1,updated_at=now() where id=c.id;
 insert into public.coupon_events(org_id,coupon_id,sale_id,action,quantity_before,quantity_after,actor_user_id,request_id) values(org,c.id,sid,'REDEEM',c.max_uses-c.used_count,c.max_uses-c.used_count-1,auth.uid(),p_request_id);
 result=jsonb_set(result,'{receipt,coupon}',jsonb_build_object('code',c.code,'name',c.name,'amount',q->>'couponDiscountAmount'));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',amount::text,'endsOn',ends_on) order by ends_on,code),'[]') into offers from public.coupons where org_id=org and deleted_at is null and show_on_receipt and starts_on<=(now() at time zone 'Asia/Bangkok')::date and ends_on>=(now() at time zone 'Asia/Bangkok')::date and used_count<max_uses and exists(select 1 from public.org_modules where org_id=org and module_code='coupons' and enabled);
 result=jsonb_set(result,'{receipt,couponOffers}',offers);
 update public.sales set result_json=result where id=sid and org_id=org;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'SALE_COMPLETED',sid,p_request_id);
 return result||jsonb_build_object('replayed',false);
end;$$;
revoke all on function private.checkout_cafe_options(jsonb,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;

create or replace function private.checkout_store_mode(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text,p_gateway boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;result jsonb;day date;n integer;sid uuid;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null for share;
 if mode='CAFE' or exists(select 1 from jsonb_array_elements(p_input->'items') x where x?'lineId' or x?'optionIds' or x?'note' or x?'cafeSnapshot') then
 result=private.checkout_cafe_options(p_input,p_key,p_request_id,p_identity_cipher,p_gateway);
 if p_gateway and exists(select 1 from jsonb_array_elements(p_input->'items') x where x?'cafeSnapshot') then mode='CAFE';end if;
 else result=private.checkout_coupon_sale(p_input,p_key,p_request_id,p_identity_cipher,p_gateway);end if;
 if coalesce((result->>'replayed')::boolean,false) or mode<>'CAFE' then return result;end if;
 day=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
 insert into public.cafe_daily_queues(org_id,queue_date,last_number) values(org,day,1)
 on conflict(org_id,queue_date) do update set last_number=public.cafe_daily_queues.last_number+1 returning last_number into n;
 result=jsonb_set(result,'{receipt,cafe}',jsonb_build_object('queueNo','A'||case when n<1000 then lpad(n::text,3,'0') else n::text end,'queueDate',day));
 sid=(result->>'saleId')::uuid;
 update public.sales set result_json=result-'replayed' where id=sid and org_id=org;
 return result;
end;$$;
notify pgrst,'reload schema';

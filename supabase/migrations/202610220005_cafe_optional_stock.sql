-- Existing products retain stock tracking. No stock ledger is invented for untracked cafe sales.
alter table public.products add column track_stock boolean not null default true;
create or replace function private.product_json(p public.products) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.id,'categoryId',p.category_id,'barcode',p.barcode,'name',p.name,
 'salePrice',p.sale_price::text,'unitCost',p.unit_cost::text,'quantity',p.quantity_on_hand,
 'trackStock',p.track_stock,'version',p.row_version,'imagePath',p.image_path);
$$;

-- Existing product/group RPC stays compatible; explicit policy writes are owner-only cafe transactions.
create function public.manage_cafe_stock_product(p_operation text,p_id uuid,p_barcode text,p_name text,p_category_id uuid,
 p_sale_price numeric,p_unit_cost numeric,p_expected_version bigint,p_request_id uuid,p_quantity integer,p_group_ids uuid[],p_group_versions jsonb,p_track_stock boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;r jsonb;p public.products;before jsonb;
begin
 org=private.coupon_org(array['OWNER'],false);
 if p_track_stock is null or (not p_track_stock and p_quantity<>0) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 r=public.manage_cafe_product(p_operation,p_id,p_barcode,p_name,p_category_id,p_sale_price,p_unit_cost,p_expected_version,p_request_id,p_quantity,p_group_ids,p_group_versions);
 select * into p from public.products where org_id=org and id=(r->>'id')::uuid for update;
 if p.track_stock is distinct from p_track_stock then
 before=private.product_json(p);
 update public.products set track_stock=p_track_stock,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where org_id=org and id=p.id;
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,request_id)
 select org,x.id,'UPDATE',before,private.product_json(x),p.row_version,x.row_version,auth.uid(),p_request_id from public.products x where x.org_id=org and x.id=p.id;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_STOCK_POLICY_SAVED',p.id,p_request_id);
 end if;
 select private.product_json(x) into r from public.products x where x.org_id=org and x.id=p.id;
 return r;
end;$$;
revoke all on function public.manage_cafe_stock_product(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid,integer,uuid[],jsonb,boolean) from public,anon,service_role;
grant execute on function public.manage_cafe_stock_product(text,uuid,text,text,uuid,numeric,numeric,bigint,uuid,integer,uuid[],jsonb,boolean) to authenticated;
-- Read-only quote. It neither reserves stock nor creates a sale.
create function private.quote_stock_policy(p_items jsonb,p_discount text,p_cafe boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_settings public.store_settings; v_item jsonb; v_product public.products;
 v_rows jsonb='[]'::jsonb; v_subtotal numeric=0; v_discount numeric; v_total numeric; v_vat numeric; v_qty integer; v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE' and m.deleted_at is null
 and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
 if jsonb_array_length(p_items) not between 1 and 200 or p_discount is null or p_discount !~ '^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
 if (select count(distinct value->>'productId') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items)
 then raise sqlstate 'PT400' using message='DUPLICATE_PRODUCT'; end if;
 v_discount=p_discount::numeric;
 select * into v_settings from public.store_settings where org_id=v_org and deleted_at is null;
 if not found then raise sqlstate 'PT409' using message='SETTINGS_UNAVAILABLE'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item)<>'object' or not (v_item ?& array['productId','quantity'])
  or (v_item - array['productId','quantity'])<>'{}'::jsonb
  or coalesce(v_item->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(v_item->'quantity')<>'number' or coalesce(v_item->>'quantity','') !~ '^[1-9][0-9]{0,9}$'
  then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
  if (v_item->>'quantity')::numeric>2147483647 then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
  v_qty=(v_item->>'quantity')::integer;
  select * into v_product from public.products where org_id=v_org and id=(v_item->>'productId')::uuid and deleted_at is null;
  if not found then raise sqlstate 'PT409' using message='PRODUCT_UNAVAILABLE'; end if;
  if (not p_cafe or v_product.track_stock) and v_product.quantity_on_hand<v_qty then raise sqlstate 'PT409' using message='INSUFFICIENT_STOCK'; end if;
  v_subtotal=v_subtotal+v_product.sale_price*v_qty;
  v_rows=v_rows||jsonb_build_array(jsonb_build_object('productId',v_product.id,'barcode',v_product.barcode,'name',v_product.name,
   'quantity',v_qty,'unitPrice',v_product.sale_price::text,'expectedVersion',v_product.row_version,
   'lineTotal',(v_product.sale_price*v_qty)::text,'stockAvailable',v_product.quantity_on_hand));
 end loop;
 if v_subtotal>999999999999.99 then raise sqlstate 'PT400' using message='AMOUNT_OUT_OF_RANGE'; end if;
 if v_discount>v_subtotal then raise sqlstate 'PT400' using message='INVALID_DISCOUNT'; end if;
 v_total=v_subtotal-v_discount;
 v_vat=case when v_settings.vat_enabled then round(v_total*v_settings.vat_rate/(100+v_settings.vat_rate),2) else 0 end;
 v_result=jsonb_build_object('items',v_rows,'subtotalAmount',v_subtotal::numeric(14,2)::text,'discountAmount',p_discount,
 'totalAmount',v_total::numeric(14,2)::text,'vatAmount',v_vat::numeric(14,2)::text,
 'vatEnabled',v_settings.vat_enabled,'vatRate',case when v_settings.vat_enabled then v_settings.vat_rate::text else '0.00' end,'promptpayQrPayload',null);
 return v_result||jsonb_build_object('quoteFingerprint',md5(v_org::text||v_result::text));
end;
$$;

revoke all on function private.quote_stock_policy(jsonb,text,boolean) from public,anon,authenticated,service_role;
create or replace function public.quote_cash_sale(p_items jsonb,p_discount text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;is_cafe boolean;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 select store_mode='CAFE' into is_cafe from public.store_settings where org_id=org and deleted_at is null;
 return private.quote_stock_policy(p_items,p_discount,coalesce(is_cafe,false));
end;$$;
create or replace function private.quote_cafe_options(p_items jsonb,p_discount text,p_coupon_code text,p_captured boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
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
create or replace function private.checkout_cafe_options(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text,p_gateway boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if not p.track_stock then continue;end if;
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
 select store_mode='CAFE' into v_cafe from public.store_settings where org_id=v_org and deleted_at is null;
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


-- Untracked cafe menus must not be flagged as low stock. Retail reports retain their existing behavior.
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
 select count(*),jsonb_build_object('productCount',count(*),'quantity',coalesce(sum(quantity_on_hand::bigint),0),'valuation',coalesce(sum(quantity_on_hand::numeric*unit_cost),0)::numeric(24,2)::text) into v_count,v_summary from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5 and (track_stock or coalesce((select store_mode<>'CAFE' from public.store_settings where org_id=v_org and deleted_at is null),true)));
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_rows from(select id,barcode,name,quantity_on_hand as quantity,unit_cost::text as "unitCost",sale_price::text as "salePrice",(quantity_on_hand::numeric*unit_cost)::numeric(24,2)::text as valuation from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5 and (track_stock or coalesce((select store_mode<>'CAFE' from public.store_settings where org_id=v_org and deleted_at is null),true))) order by name,id limit p_limit offset(p_page-1)*p_limit)t;
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
 v_result=v_result||jsonb_build_object('lowStockCount',(select count(*) from public.products where org_id=v_org and deleted_at is null and quantity_on_hand<=5 and (track_stock or coalesce((select store_mode<>'CAFE' from public.store_settings where org_id=v_org and deleted_at is null),true))),'dateBangkok',to_char(v_today at time zone 'Asia/Bangkok','YYYY-MM-DD'));
 v_result=v_result||jsonb_build_object('cashToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='CASH'),0)::numeric(20,2)::text,'promptpayToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='PROMPTPAY'),0)::numeric(20,2)::text);
 v_top='[]'::jsonb;
 if p_include_top then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_top from(select i.product_id as "productId",(array_agg(i.product_name_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as name,(array_agg(i.barcode_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as barcode,sum(i.quantity::bigint) as quantity,sum(i.line_total)::numeric(20,2)::text as net from public.sale_items i join public.sales s on s.org_id=i.org_id and s.id=i.sale_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_month and s.completed_at<v_next group by i.product_id order by sum(i.quantity::bigint) desc,i.product_id limit 5)t;
 end if;
 return v_result||jsonb_build_object('topProducts',v_top);
end;$$;
notify pgrst,'reload schema';

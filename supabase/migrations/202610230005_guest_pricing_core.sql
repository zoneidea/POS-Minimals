-- Extract existing price/option logic into private tenant-scoped cores. Staff signatures and authorization stay unchanged.
create function private.quote_stock_scoped(p_org uuid,p_items jsonb,p_discount text,p_cafe boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_settings public.store_settings; v_item jsonb; v_product public.products;
 v_rows jsonb='[]'::jsonb; v_subtotal numeric=0; v_discount numeric; v_total numeric; v_vat numeric; v_qty integer; v_result jsonb;
begin
 v_org=p_org;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
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
create or replace function private.quote_cafe_scoped(p_org uuid,p_items jsonb,p_discount text,p_coupon_code text,p_captured boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;item jsonb;rows jsonb='[]';aggregated jsonb;base jsonb;p public.products;g public.cafe_option_groups;opts jsonb;snapshot jsonb;ids jsonb;cfg jsonb;choice_count int;matched int;
 qty integer;unit numeric;subtotal numeric=0;discount numeric;coupon_discount numeric=0;total numeric;vat numeric;note text;line_id text;c public.coupons;fingerprint text;
begin
 org=p_org;
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
 base=private.quote_stock_scoped(org,aggregated,'0.00',true);
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

create or replace function private.quote_stock_policy(p_items jsonb,p_discount text,p_cafe boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 return private.quote_stock_scoped(org,p_items,p_discount,p_cafe);
end;$$;
create or replace function private.quote_cafe_options(p_items jsonb,p_discount text,p_coupon_code text,p_captured boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return private.quote_cafe_scoped(private.coupon_org(array['OWNER','EMPLOYEE'],false),p_items,p_discount,p_coupon_code,p_captured);
end;$$;
revoke all on function private.quote_stock_scoped(uuid,jsonb,text,boolean),private.quote_cafe_scoped(uuid,jsonb,text,text,boolean) from public,anon,authenticated,service_role;

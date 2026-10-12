-- Read-only quote. It neither reserves stock nor creates a sale.
create function public.quote_cash_sale(p_items jsonb,p_discount text) returns jsonb
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
  if v_product.quantity_on_hand<v_qty then raise sqlstate 'PT409' using message='INSUFFICIENT_STOCK'; end if;
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
revoke all on function public.quote_cash_sale(jsonb,text) from public,anon;
grant execute on function public.quote_cash_sale(jsonb,text) to authenticated;

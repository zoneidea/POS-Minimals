-- Compact, lossless UUID-derived bill numbers for new sales only.
-- Existing records, snapshots and idempotent replays remain unchanged.
create or replace function public.checkout_cash_sale(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_existing public.sales;v_item jsonb;v_row public.products;v_quote jsonb;v_input jsonb;v_sale uuid=gen_random_uuid();
 v_sale_no text;v_result jsonb;v_receipt_items jsonb='[]'::jsonb;v_before jsonb;v_discount numeric;v_allocated numeric=0;v_line_discount numeric;
 v_gross numeric=0;v_subtotal numeric;v_total numeric;v_received numeric;v_qty integer;v_index integer=0;v_count integer;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN'; end if;
 if p_key is null or p_request_id is null or p_identity_cipher is null or char_length(p_identity_cipher) not between 1 and 10000
 or p_input is null or jsonb_typeof(p_input)<>'object' or not(p_input ?& array['items','discountAmount','expectedTotalAmount','payment'])
 or (p_input - array['items','discountAmount','expectedTotalAmount','payment'])<>'{}'::jsonb
 or jsonb_typeof(p_input->'items')<>'array' then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
 if coalesce(p_input->>'discountAmount','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 or coalesce(p_input->>'expectedTotalAmount','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 or coalesce(p_input->'payment'->>'receivedAmount','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 or coalesce(p_input->'payment'->>'method','')<>'CASH'
 or ((p_input->'payment') - array['method','receivedAmount'])<>'{}'::jsonb
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 v_count=jsonb_array_length(p_input->'items');if v_count not between 1 and 200 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 for v_item in select value from jsonb_array_elements(p_input->'items') loop
 if jsonb_typeof(v_item)<>'object' or not(v_item ?& array['productId','quantity','expectedUnitPrice','expectedVersion'])
 or (v_item - array['productId','quantity','expectedUnitPrice','expectedVersion'])<>'{}'::jsonb
 or coalesce(v_item->>'productId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 or jsonb_typeof(v_item->'quantity')<>'number' or coalesce(v_item->>'quantity','')!~'^[1-9][0-9]{0,9}$'
 or (v_item->>'quantity')::numeric>2147483647
 or jsonb_typeof(v_item->'expectedVersion')<>'number' or coalesce(v_item->>'expectedVersion','')!~'^[1-9][0-9]{0,15}$'
 or (v_item->>'expectedVersion')::numeric>9007199254740991
 or coalesce(v_item->>'expectedUnitPrice','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;end loop;
 if(select count(distinct value->>'productId') from jsonb_array_elements(p_input->'items'))<>v_count then raise sqlstate 'PT400' using message='DUPLICATE_PRODUCT';end if;
 v_input=p_input||jsonb_build_object('actor',auth.uid());
 perform pg_advisory_xact_lock(hashtextextended(v_org::text||':sale:'||p_key::text,0));
 select * into v_existing from public.sales where org_id=v_org and request_key=p_key;
 if found then if v_existing.input_json<>v_input then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;
 return v_existing.result_json||jsonb_build_object('replayed',true);end if;
 -- Stable lock order prevents two baskets locking the same products in reverse order.
 perform 1 from public.products p where p.org_id=v_org and p.id in(select (value->>'productId')::uuid from jsonb_array_elements(p_input->'items')) order by p.id for update;
 perform 1 from public.store_settings where org_id=v_org for share;
 v_quote=public.quote_cash_sale((select jsonb_agg(jsonb_build_object('productId',value->>'productId','quantity',(value->>'quantity')::integer)) from jsonb_array_elements(p_input->'items')),p_input->>'discountAmount');
 for v_item in select value from jsonb_array_elements(p_input->'items') loop
 select * into v_row from public.products where org_id=v_org and id=(v_item->>'productId')::uuid and deleted_at is null;
 if not found or v_row.sale_price<>(v_item->>'expectedUnitPrice')::numeric or v_row.row_version<>(v_item->>'expectedVersion')::bigint then raise sqlstate 'PT409' using message='CART_STALE';end if;end loop;
 v_subtotal=(v_quote->>'subtotalAmount')::numeric;v_total=(v_quote->>'totalAmount')::numeric;v_received=(p_input->'payment'->>'receivedAmount')::numeric;v_discount=(p_input->>'discountAmount')::numeric;
 if v_total<>(p_input->>'expectedTotalAmount')::numeric then raise sqlstate 'PT409' using message='CART_STALE';end if;
 if v_received<v_total then raise sqlstate 'PT400' using message='INSUFFICIENT_PAYMENT';end if;
 v_sale_no='B'||translate(rtrim(encode(uuid_send(v_sale),'base64'),'='),'+/','-_');
 insert into public.sales(id,org_id,sale_no,cashier_id,subtotal_amount,discount_amount,vat_amount,total_amount,request_key,request_id,input_json,result_json,identity_cipher)
 values(v_sale,v_org,v_sale_no,auth.uid(),v_subtotal,v_discount,(v_quote->>'vatAmount')::numeric,v_total,p_key,p_request_id,v_input,'{}',p_identity_cipher);
 for v_item in select value from jsonb_array_elements(p_input->'items') loop
 select * into v_row from public.products where org_id=v_org and id=(v_item->>'productId')::uuid;
 v_qty=(v_item->>'quantity')::integer;v_index=v_index+1;
 v_gross=v_gross+v_row.sale_price*v_qty;
 v_line_discount=case when v_index=v_count then v_discount-v_allocated when v_subtotal=0 then 0 else trunc(v_discount*v_gross/v_subtotal,2)-v_allocated end;
 v_allocated=v_allocated+v_line_discount;
 insert into public.sale_items(org_id,sale_id,product_id,barcode_snapshot,product_name_snapshot,quantity,unit_price,unit_cost,discount_amount,line_total)
 values(v_org,v_sale,v_row.id,v_row.barcode,v_row.name,v_qty,v_row.sale_price,v_row.unit_cost,v_line_discount,v_row.sale_price*v_qty-v_line_discount);
 v_receipt_items=v_receipt_items||jsonb_build_array(jsonb_build_object('barcode',v_row.barcode,'productName',v_row.name,'quantity',v_qty,'unitPrice',v_row.sale_price::text,'discountAmount',v_line_discount::numeric(14,2)::text,'lineTotal',(v_row.sale_price*v_qty-v_line_discount)::numeric(14,2)::text));
 v_before=private.product_json(v_row);
 update public.products set quantity_on_hand=quantity_on_hand-v_qty,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where id=v_row.id;
 insert into public.stock_movements(org_id,product_id,sale_id,movement_type,quantity_delta,quantity_before,quantity_after,product_name_snapshot,barcode_snapshot,reason,performed_by,request_id,request_key,input_json,result_json)
 values(v_org,v_row.id,v_sale,'SALE_OUT',-v_qty,v_row.quantity_on_hand,v_row.quantity_on_hand-v_qty,v_row.name,v_row.barcode,'ขายสินค้า '||v_sale_no,auth.uid(),p_request_id,gen_random_uuid(),v_input,jsonb_build_object('saleId',v_sale));
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,reason,request_id)
 select v_org,p.id,'SALE_OUT',v_before,private.product_json(p),v_row.row_version,p.row_version,auth.uid(),'ขายสินค้า '||v_sale_no,p_request_id from public.products p where p.id=v_row.id;
 end loop;
 insert into public.payments(org_id,sale_id,method,amount,received_amount,change_amount,confirmed_by) values(v_org,v_sale,'CASH',v_total,v_received,v_received-v_total,auth.uid());
 v_result=jsonb_build_object('saleId',v_sale,'saleNo',v_sale_no,'status','COMPLETED','totalAmount',v_total::numeric(14,2)::text,'receivedAmount',v_received::numeric(14,2)::text,'changeAmount',(v_received-v_total)::numeric(14,2)::text,
 'identityCipher',p_identity_cipher,'receipt',jsonb_build_object('receiptSchemaVersion',1,'saleId',v_sale,'saleNo',v_sale_no,'completedAtUtc',now(),'items',v_receipt_items,'totals',jsonb_build_object('subtotal',v_subtotal::numeric(14,2)::text,'discount',v_discount::numeric(14,2)::text,'vat',v_quote->>'vatAmount','total',v_total::numeric(14,2)::text,'received',v_received::numeric(14,2)::text,'change',(v_received-v_total)::numeric(14,2)::text),'vatRate',v_quote->>'vatRate','vatEnabled',v_quote->'vatEnabled','paymentMethod','CASH','saleStatus','COMPLETED'));
 update public.sales set result_json=v_result where id=v_sale;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(v_org,auth.uid(),'SALE_COMPLETED',v_sale,p_request_id);
 return v_result||jsonb_build_object('replayed',false);
end;
$$;
revoke all on function public.checkout_cash_sale(jsonb,uuid,uuid,text) from public,anon;
grant execute on function public.checkout_cash_sale(jsonb,uuid,uuid,text) to authenticated;

notify pgrst,'reload schema';

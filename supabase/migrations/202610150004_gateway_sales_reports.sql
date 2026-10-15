alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check check(method in ('CASH','PROMPTPAY'));
alter table public.payments add column provider_payment_id text unique,add column gateway_fee numeric(14,2),add column gateway_net numeric(14,2);
alter table public.payments add constraint gateway_amounts check ((provider_payment_id is null and gateway_fee is null and gateway_net is null) or (method='PROMPTPAY' and provider_payment_id ~ '^pay_' and gateway_fee>=0 and gateway_net=amount-gateway_fee and gateway_net>=0));
alter table public.reservepay_payment_sessions add column checkout_input jsonb,add column identity_cipher text,add column verified_fee numeric(14,2),add column paid_at timestamptz,add column verified_at timestamptz,add column sale_id uuid;
alter table public.reservepay_payment_sessions add constraint gateway_sale_fk foreign key(org_id,sale_id) references public.sales(org_id,id);
grant update(checkout_input,identity_cipher,verified_fee,paid_at,verified_at) on public.reservepay_payment_sessions to service_role;
create function private.protect_gateway_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if old.checkout_input is not null and (new.checkout_input is distinct from old.checkout_input or new.identity_cipher is distinct from old.identity_cipher) then raise sqlstate 'PT409' using message='SNAPSHOT_IMMUTABLE';end if;
 if old.sale_id is not null and (new.verified_fee is distinct from old.verified_fee or new.paid_at is distinct from old.paid_at) then raise sqlstate 'PT409' using message='PAYMENT_ALREADY_POSTED';end if;
 return new;
end;$$;
revoke all on function private.protect_gateway_snapshot() from public,anon,authenticated;
create trigger gateway_snapshot_immutable before update on public.reservepay_payment_sessions for each row execute function private.protect_gateway_snapshot();
create or replace function private.checkout_gateway_core(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text)
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
revoke all on function private.checkout_gateway_core(jsonb,uuid,uuid,text) from public,anon,authenticated,service_role;
create function public.complete_gateway_sale(p_hash text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v public.reservepay_payment_sessions;result jsonb;sid uuid;k uuid;checkout jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 select * into v from public.reservepay_payment_sessions where session_hash=p_hash and org_id=v_org and user_id=auth.uid() for update;
 if not found then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if v.sale_id is not null then return (select result_json||jsonb_build_object('replayed',true) from public.sales where id=v.sale_id and org_id=v_org);end if;
 if v.verified_at is null or v.verified_at<clock_timestamp()-interval '60 seconds' or v.paid_at is null or v.payment_id is null or v.checkout_input is null or v.identity_cipher is null or v.verified_fee is null or v.verified_fee<0 or v.verified_fee>(v.amount_minor::numeric/100) then raise sqlstate 'PT409' using message='PAYMENT_NOT_VERIFIED';end if;
 k=(substr(p_hash,1,8)||'-'||substr(p_hash,9,4)||'-'||substr(p_hash,13,4)||'-'||substr(p_hash,17,4)||'-'||substr(p_hash,21,12))::uuid;
 if (v.checkout_input->>'expectedTotalAmount')::numeric<>v.amount_minor::numeric/100 then raise sqlstate 'PT409' using message='PAYMENT_AMOUNT_MISMATCH';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_org::text||':sale:'||k::text,0));
 perform 1 from public.products p where p.org_id=v_org and p.id in(select (value->>'productId')::uuid from jsonb_array_elements(v.checkout_input->'items')) order by p.id for update;
 -- Stock-only version changes do not invalidate an already paid quote; price and stock checks remain live.
 select jsonb_set(v.checkout_input,'{items}',jsonb_agg(jsonb_set(i.value,'{expectedVersion}',to_jsonb(coalesce(p.row_version,(i.value->>'expectedVersion')::bigint))) order by i.ordinality)) into checkout from jsonb_array_elements(v.checkout_input->'items') with ordinality i(value,ordinality) left join public.products p on p.id=(i.value->>'productId')::uuid and p.org_id=v_org;
 result=private.checkout_gateway_core(checkout,k,p_request,v.identity_cipher);sid=(result->>'saleId')::uuid;
 result=jsonb_set(result,'{receipt,paymentMethod}','"PROMPTPAY"');
 result=jsonb_set(result,'{receipt,completedAtUtc}',to_jsonb(v.paid_at));
 update public.sales set completed_at=v.paid_at,result_json=result-'replayed' where id=sid and org_id=v_org;
 update public.payments set method='PROMPTPAY',provider_payment_id=v.payment_id,gateway_fee=v.verified_fee,gateway_net=amount-v.verified_fee where sale_id=sid and org_id=v_org;
 update public.reservepay_payment_sessions set sale_id=sid where session_hash=p_hash;
 return result;
end;$$;
revoke all on function public.complete_gateway_sale(text,uuid) from public,anon,service_role;
grant execute on function public.complete_gateway_sale(text,uuid) to authenticated;
create function public.gateway_sales_report(p_from timestamptz,p_to timestamptz,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;rows jsonb;summary jsonb;n bigint;
begin
 select m.org_id into org from public.organization_members m join public.organizations o on o.id=m.org_id where m.user_id=auth.uid() and m.role in ('OWNER','ACCOUNTANT') and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' or p_page<1 or p_page>100000 then raise sqlstate 'PT400' using message='INVALID_RANGE';end if;
 select count(*),jsonb_build_object('gross',coalesce(sum(p.amount),0)::numeric(24,2)::text,'fees',coalesce(sum(p.gateway_fee),0)::numeric(24,2)::text,'net',coalesce(sum(p.gateway_net),0)::numeric(24,2)::text) into n,summary from public.sales s join public.payments p on p.org_id=s.org_id and p.sale_id=s.id where s.org_id=org and s.status='COMPLETED' and p.method='PROMPTPAY' and p.provider_payment_id is not null and s.completed_at>=p_from and s.completed_at<p_to;
 select coalesce(jsonb_agg(t.row),'[]'::jsonb) into rows from (select jsonb_build_object('id',s.id,'saleNo',s.sale_no,'paymentId',p.provider_payment_id,'completedAtUtc',s.completed_at,'gross',p.amount::text,'fee',p.gateway_fee::text,'net',p.gateway_net::text,'identityCipher',s.identity_cipher) as row from public.sales s join public.payments p on p.org_id=s.org_id and p.sale_id=s.id where s.org_id=org and s.status='COMPLETED' and p.method='PROMPTPAY' and p.provider_payment_id is not null and s.completed_at>=p_from and s.completed_at<p_to order by s.completed_at desc,s.id desc limit 10 offset (p_page-1)*10)t;
 return jsonb_build_object('items',rows,'total',n,'summary',summary,'page',p_page,'limit',10);
end;$$;
revoke all on function public.gateway_sales_report(timestamptz,timestamptz,integer) from public,anon,service_role;
grant execute on function public.gateway_sales_report(timestamptz,timestamptz,integer) to authenticated;
-- A local cash cancellation must never pretend to void a provider payment.
do $block$ declare definition text;begin
 definition=pg_get_functiondef('public.void_sale(uuid,text,uuid)'::regprocedure);
 definition=replace(definition,'if v_sale.status=''VOIDED'' then','if exists(select 1 from public.payments where sale_id=p_id and org_id=v_org and provider_payment_id is not null) then raise sqlstate ''PT409'' using message=''GATEWAY_VOID_REQUIRES_PROVIDER'';end if; if v_sale.status=''VOIDED'' then');
 if position('GATEWAY_VOID_REQUIRES_PROVIDER' in definition)=0 then raise exception 'Gateway void guard could not be installed';end if;
 execute definition;
end;$block$;
notify pgrst,'reload schema';

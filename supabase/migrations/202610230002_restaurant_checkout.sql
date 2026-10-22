-- Shared Checkout UI uses immutable table-round pricing, normal VAT and coupon rules.
-- Keep the original RPC signature and original zero-discount replay identity intact.
create function private.restaurant_quote(p_org uuid,p_bill uuid,p_version bigint,p_discount text,p_coupon text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.restaurant_bills;items jsonb;q jsonb;rows jsonb;
begin
 select * into b from public.restaurant_bills where org_id=p_org and id=p_bill;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if b.status<>'OPEN' or p_version is null or b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 select coalesce(jsonb_agg(i order by r.number,n),'[]') into items from public.restaurant_rounds r,lateral jsonb_array_elements(r.items) with ordinality x(i,n) where r.org_id=p_org and r.bill_id=p_bill and r.cancelled_at is null;
 if jsonb_array_length(items)=0 then raise sqlstate 'PT409' using message='EMPTY_BILL';end if;
 select jsonb_agg(jsonb_build_object('productId',i->>'productId','lineId',i->>'lineId','optionIds',i->'optionIds','note',i->>'note','quantity',(i->>'quantity')::int,'cafeSnapshot',i->'cafeSnapshot')) into rows from jsonb_array_elements(items) i;
 q=private.quote_cafe_options(rows,p_discount,p_coupon,true);
 select jsonb_agg(x||jsonb_build_object('name',i->>'name','barcode',i->>'barcode') order by n) into rows from jsonb_array_elements(q->'items') with ordinality a(x,n) join jsonb_array_elements(items) i on i->>'lineId'=x->>'lineId';
 q=jsonb_set(q,'{items}',rows);
 return q||jsonb_build_object('quoteFingerprint',md5(q::text||p_version::text));
end;$$;
create function public.restaurant_quote_bill(p_bill uuid,p_version bigint,p_discount text,p_coupon text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org=private.restaurant_org();
 return private.restaurant_quote(org,p_bill,p_version,p_discount,p_coupon);
end;$$;

create function private.restaurant_cash_settle(p_bill uuid,p_version bigint,p_received text,p_total text,p_key uuid,p_request uuid,p_identity_cipher text,p_discount text,p_coupon text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;items jsonb;q jsonb;input jsonb;result jsonb;row jsonb;sid uuid;
begin
 org=private.restaurant_org();
 if p_discount is null or p_discount!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' or p_key is null or p_request is null or p_received is null or p_received!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
 or p_total is null or p_total!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 input=jsonb_build_object('version',p_version,'received',p_received,'total',p_total,'actor',auth.uid())||case when p_discount<>'0.00' or p_coupon is not null then jsonb_build_object('discount',p_discount,'coupon',p_coupon) else '{}'::jsonb end;
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
 if p_total<>(private.restaurant_quote(org,p_bill,p_version,p_discount,p_coupon)->>'totalAmount') then raise sqlstate 'PT409' using message='CART_STALE';end if;
 result=private.checkout_cafe_options(jsonb_build_object('items',q,'discountAmount',p_discount,'expectedTotalAmount',p_total,'payment',jsonb_build_object('method','CASH','receivedAmount',p_received))||case when p_coupon is not null then jsonb_build_object('couponCode',p_coupon) else '{}'::jsonb end,p_key,p_request,p_identity_cipher,true);
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
create or replace function public.restaurant_checkout_cash(p_bill uuid,p_version bigint,p_received text,p_total text,p_key uuid,p_request uuid,p_identity_cipher text) returns jsonb language sql security definer set search_path='' as $$
 select private.restaurant_cash_settle(p_bill,p_version,p_received,p_total,p_key,p_request,p_identity_cipher,'0.00',null)
$$;
create function public.restaurant_checkout_cash_v2(p_bill uuid,p_version bigint,p_received text,p_total text,p_key uuid,p_request uuid,p_identity_cipher text,p_discount text,p_coupon text default null) returns jsonb language sql security definer set search_path='' as $$
 select private.restaurant_cash_settle(p_bill,p_version,p_received,p_total,p_key,p_request,p_identity_cipher,p_discount,p_coupon)
$$;
revoke all on function private.restaurant_quote(uuid,uuid,bigint,text,text),private.restaurant_cash_settle(uuid,bigint,text,text,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.restaurant_quote_bill(uuid,bigint,text,text),public.restaurant_checkout_cash_v2(uuid,bigint,text,text,uuid,uuid,text,text,text) from public,anon,service_role;
grant execute on function public.restaurant_quote_bill(uuid,bigint,text,text),public.restaurant_checkout_cash_v2(uuid,bigint,text,text,uuid,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';

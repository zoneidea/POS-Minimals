create or replace function public.sale_bill_view(p_id uuid default null,p_page integer default 1,p_from timestamptz default null,p_to timestamptz default null,p_group text default 'day',p_period date default null,p_cashier uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; v_count bigint;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id) in ('OWNER','ACCOUNTANT','EMPLOYEE');
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_group is null or p_group not in ('day','week','month','year') or (p_from is null)<>(p_to is null) or (p_from is not null and (p_to<=p_from or p_to-p_from>interval '366 days')) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_id is not null then
  select jsonb_build_object('sale',s.result_json,'status',s.status,'voidedAtUtc',s.voided_at,'voidReason',s.void_reason) into v_result from public.sales s where s.id=p_id and s.org_id=v_org and (private.current_org_role(v_org)<>'EMPLOYEE' or s.cashier_id=auth.uid());
  if v_result is null then raise sqlstate 'PT404' using message='NOT_FOUND';end if;return v_result;
 end if;
 with filtered as(select s.* from public.sales s where s.org_id=v_org and (private.current_org_role(v_org)<>'EMPLOYEE' or (s.cashier_id=auth.uid() and (s.completed_at at time zone 'Asia/Bangkok')::date=(now() at time zone 'Asia/Bangkok')::date)) and (p_from is null or (s.completed_at>=p_from and s.completed_at<p_to)) and (p_cashier is null or s.cashier_id=p_cashier) and (p_period is null or date_trunc(p_group,s.completed_at at time zone 'Asia/Bangkok')::date=p_period))
 select count(*),coalesce((select jsonb_agg(t.row) from(select jsonb_build_object('id',s.id,'saleNo',s.sale_no,'status',s.status,'totalAmount',s.total_amount::text,'completedAtUtc',s.completed_at,'voidDeadlineUtc',(date_trunc('day',s.completed_at at time zone 'Asia/Bangkok')+interval '1 day') at time zone 'Asia/Bangkok','voidedAtUtc',s.voided_at,'voidReason',s.void_reason,'identityCipher',s.identity_cipher,'itemCount',(select coalesce(sum(i.quantity::bigint),0) from public.sale_items i where i.org_id=v_org and i.sale_id=s.id),'paymentMethod',p.method,'receivedAmount',p.received_amount::text) as row from filtered s join public.payments p on p.org_id=v_org and p.sale_id=s.id order by s.completed_at desc,s.id desc limit 10 offset(p_page-1)*10)t),'[]'::jsonb) into v_count,v_result from filtered;
 return jsonb_build_object('items',v_result,'total',v_count,'page',p_page,'limit',10);
end;$$;
revoke all on function public.sale_bill_view(uuid,integer,timestamptz,timestamptz,text,date,uuid) from public,anon;
grant execute on function public.sale_bill_view(uuid,integer,timestamptz,timestamptz,text,date,uuid) to authenticated;
notify pgrst,'reload schema';

create or replace function public.void_sale(p_id uuid,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_sale public.sales;v_product public.products;v_move public.stock_movements;v_before jsonb;v_next bigint;v_now timestamptz;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_id is null or p_request_id is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_sale from public.sales where org_id=v_org and id=p_id for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if v_sale.status='VOIDED' then
 if v_sale.void_reason<>btrim(p_reason) then raise sqlstate 'PT409' using message='ALREADY_VOIDED';end if;
 return jsonb_build_object('saleId',v_sale.id,'status','VOIDED','voidedAtUtc',v_sale.voided_at,'replayed',true);end if;
 -- Use wall clock after the sale lock; lock wait must not extend the window.
 v_now=clock_timestamp();
 if (v_now at time zone 'Asia/Bangkok')::date<>(v_sale.completed_at at time zone 'Asia/Bangkok')::date or v_now<v_sale.completed_at then raise sqlstate 'PT409' using message='VOID_WINDOW_EXPIRED';end if;
 perform 1 from public.products p where p.org_id=v_org and p.id in(select product_id from public.stock_movements where org_id=v_org and sale_id=p_id and movement_type='SALE_OUT') order by p.id for update;
 v_now=clock_timestamp();if (v_now at time zone 'Asia/Bangkok')::date<>(v_sale.completed_at at time zone 'Asia/Bangkok')::date then raise sqlstate 'PT409' using message='VOID_WINDOW_EXPIRED';end if;
 for v_move in select * from public.stock_movements where org_id=v_org and sale_id=p_id and movement_type='SALE_OUT' order by product_id loop
 select * into strict v_product from public.products where org_id=v_org and id=v_move.product_id;
 v_next=v_product.quantity_on_hand::bigint-v_move.quantity_delta::bigint;
 if v_next>2147483647 or v_product.row_version>=9007199254740991 then raise sqlstate 'PT409' using message='STOCK_LIMIT_EXCEEDED';end if;
 v_before=private.product_json(v_product);
 update public.products set quantity_on_hand=v_next,row_version=row_version+1,updated_at=v_now,updated_by=auth.uid() where org_id=v_org and id=v_product.id;
 insert into public.stock_movements(org_id,product_id,sale_id,movement_type,quantity_delta,quantity_before,quantity_after,product_name_snapshot,barcode_snapshot,reason,performed_by,created_at,request_id,request_key,input_json,result_json)
 values(v_org,v_product.id,p_id,'SALE_VOID_IN',-v_move.quantity_delta,v_product.quantity_on_hand,v_next,v_move.product_name_snapshot,v_move.barcode_snapshot,btrim(p_reason),auth.uid(),v_now,p_request_id,gen_random_uuid(),jsonb_build_object('saleId',p_id,'reason',btrim(p_reason)),jsonb_build_object('saleId',p_id,'status','VOIDED'));
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,reason,request_id)
 select v_org,p.id,'REVERSE',v_before,private.product_json(p),v_product.row_version,p.row_version,auth.uid(),btrim(p_reason),p_request_id from public.products p where p.org_id=v_org and p.id=v_product.id;
 end loop;
 update public.sales set status='VOIDED',voided_at=v_now,voided_by=auth.uid(),void_reason=btrim(p_reason) where org_id=v_org and id=p_id;
 insert into public.sale_void_logs(org_id,sale_id,actor_user_id,reason,created_at,request_id,before_json,after_json)
 values(v_org,p_id,auth.uid(),btrim(p_reason),v_now,p_request_id,jsonb_build_object('status',v_sale.status),jsonb_build_object('status','VOIDED','voidedAtUtc',v_now));
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(v_org,auth.uid(),'SALE_VOIDED',p_id,p_request_id);
 return jsonb_build_object('saleId',p_id,'status','VOIDED','voidedAtUtc',v_now,'replayed',false);
end;$$;
revoke all on function public.void_sale(uuid,text,uuid) from public,anon;
grant execute on function public.void_sale(uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';

create function public.sale_bill_view(p_id uuid default null,p_page integer default 1,p_from timestamptz default null,p_to timestamptz default null,p_group text default 'day',p_period date default null,p_cashier uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_result jsonb; v_count bigint;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id) in ('OWNER','ACCOUNTANT');
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_group is null or p_group not in ('day','week','month','year') or (p_from is null)<>(p_to is null) or (p_from is not null and (p_to<=p_from or p_to-p_from>interval '366 days')) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_id is not null then
  select jsonb_build_object('sale',s.result_json,'status',s.status,'voidedAtUtc',s.voided_at,'voidReason',s.void_reason) into v_result from public.sales s where s.id=p_id and s.org_id=v_org;
  if v_result is null then raise sqlstate 'PT404' using message='NOT_FOUND';end if;return v_result;
 end if;
 with filtered as(select s.* from public.sales s where s.org_id=v_org and (p_from is null or (s.completed_at>=p_from and s.completed_at<p_to)) and (p_cashier is null or s.cashier_id=p_cashier) and (p_period is null or date_trunc(p_group,s.completed_at at time zone 'Asia/Bangkok')::date=p_period))
 select count(*),coalesce((select jsonb_agg(t.row) from(select jsonb_build_object('id',s.id,'saleNo',s.sale_no,'status',s.status,'totalAmount',s.total_amount::text,'completedAtUtc',s.completed_at,'voidDeadlineUtc',s.completed_at+interval '24 hours','voidedAtUtc',s.voided_at,'voidReason',s.void_reason,'identityCipher',s.identity_cipher,'itemCount',(select coalesce(sum(i.quantity::bigint),0) from public.sale_items i where i.org_id=v_org and i.sale_id=s.id),'paymentMethod',p.method,'receivedAmount',p.received_amount::text) as row from filtered s join public.payments p on p.org_id=v_org and p.sale_id=s.id order by s.completed_at desc,s.id desc limit 10 offset(p_page-1)*10)t),'[]'::jsonb) into v_count,v_result from filtered;
 return jsonb_build_object('items',v_result,'total',v_count,'page',p_page,'limit',10);
end;$$;
revoke all on function public.sale_bill_view(uuid,integer,timestamptz,timestamptz,text,date,uuid) from public,anon;
grant execute on function public.sale_bill_view(uuid,integer,timestamptz,timestamptz,text,date,uuid) to authenticated;
notify pgrst,'reload schema';

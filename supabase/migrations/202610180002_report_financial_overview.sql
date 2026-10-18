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
 select count(*),jsonb_build_object('productCount',count(*),'quantity',coalesce(sum(quantity_on_hand::bigint),0),'valuation',coalesce(sum(quantity_on_hand::numeric*unit_cost),0)::numeric(24,2)::text) into v_count,v_summary from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5);
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_rows from(select id,barcode,name,quantity_on_hand as quantity,unit_cost::text as "unitCost",sale_price::text as "salePrice",(quantity_on_hand::numeric*unit_cost)::numeric(24,2)::text as valuation from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5) order by name,id limit p_limit offset(p_page-1)*p_limit)t;
 end if;
 return jsonb_build_object('type',p_type,'summary',v_summary,'items',v_rows,'total',v_count,'page',p_page,'limit',p_limit)||case when p_type='sales' then jsonb_build_object('financial',v_financial) else '{}'::jsonb end;
end;$$;

revoke all on function public.report_data(text,timestamptz,timestamptz,text,uuid,integer,integer) from public,anon;
grant execute on function public.report_data(text,timestamptz,timestamptz,text,uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';

create function public.report_data(p_type text,p_from timestamptz,p_to timestamptz,p_group text default 'day',p_cashier uuid default null,p_page integer default 1,p_limit integer default 10)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_rows jsonb;v_summary jsonb;v_count bigint;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id) in ('OWNER','ACCOUNTANT');
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_type is null or p_type not in ('sales','inventory','low-stock','stock-valuation') or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 10000 or p_group is null or p_group not in ('day','week','month','year') then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_type='sales' then
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise sqlstate 'PT400' using message='INVALID_DATE_RANGE';end if;
 select jsonb_build_object('gross',coalesce(sum(subtotal_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'discount',coalesce(sum(discount_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'net',coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'vat',coalesce(sum(vat_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'billCount',count(*) filter(where status='COMPLETED'),'voidCount',count(*) filter(where status='VOIDED'),'voidAmount',coalesce(sum(total_amount) filter(where status='VOIDED'),0)::numeric(20,2)::text)
 into v_summary from public.sales where org_id=v_org and completed_at>=p_from and completed_at<p_to and (p_cashier is null or cashier_id=p_cashier);
 with groups as(select date_trunc(p_group,completed_at at time zone 'Asia/Bangkok') as period,
 coalesce(sum(subtotal_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as gross,coalesce(sum(discount_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as discount,coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as net,coalesce(sum(vat_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text as vat,count(*) filter(where status='COMPLETED') as "billCount",count(*) filter(where status='VOIDED') as "voidCount",coalesce(sum(total_amount) filter(where status='VOIDED'),0)::numeric(20,2)::text as "voidAmount"
 from public.sales where org_id=v_org and completed_at>=p_from and completed_at<p_to and (p_cashier is null or cashier_id=p_cashier) group by 1)
 select count(*),coalesce((select jsonb_agg(to_jsonb(t)) from(select to_char(period,'YYYY-MM-DD') as period,gross,discount,net,vat,"billCount","voidCount","voidAmount" from groups order by period desc limit p_limit offset (p_page-1)*p_limit)t),'[]'::jsonb) into v_count,v_rows from groups;
 else
 select count(*),jsonb_build_object('productCount',count(*),'quantity',coalesce(sum(quantity_on_hand::bigint),0),'valuation',coalesce(sum(quantity_on_hand::numeric*unit_cost),0)::numeric(24,2)::text) into v_count,v_summary from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5);
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_rows from(select id,barcode,name,quantity_on_hand as quantity,unit_cost::text as "unitCost",sale_price::text as "salePrice",(quantity_on_hand::numeric*unit_cost)::numeric(24,2)::text as valuation from public.products where org_id=v_org and deleted_at is null and (p_type<>'low-stock' or quantity_on_hand<=5) order by name,id limit p_limit offset(p_page-1)*p_limit)t;
 end if;
 return jsonb_build_object('type',p_type,'summary',v_summary,'items',v_rows,'total',v_count,'page',p_page,'limit',p_limit);
end;$$;
create function public.report_cashiers() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id) in ('OWNER','ACCOUNTANT');
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_result from(select m.user_id as id,m.display_username as alias from public.organization_members m where m.org_id=v_org and exists(select 1 from public.sales s where s.org_id=v_org and s.cashier_id=m.user_id) order by m.display_username,m.id)t;
 return v_result;
end;$$;
create function public.dashboard_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_today timestamptz;v_month timestamptz;v_next timestamptz;v_result jsonb;v_top jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id)='OWNER';
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 v_today=date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
 v_month=date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';v_next=(date_trunc('day',now() at time zone 'Asia/Bangkok')+interval '1 day') at time zone 'Asia/Bangkok';
 select jsonb_build_object('todaySales',coalesce(sum(total_amount) filter(where status='COMPLETED' and completed_at>=v_today),0)::numeric(20,2)::text,'monthSales',coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'todayBills',count(*) filter(where status='COMPLETED' and completed_at>=v_today),'todayVoids',count(*) filter(where status='VOIDED' and completed_at>=v_today)) into v_result from public.sales where org_id=v_org and completed_at>=v_month and completed_at<v_next;
 v_result=v_result||jsonb_build_object('lowStockCount',(select count(*) from public.products where org_id=v_org and deleted_at is null and quantity_on_hand<=5),'dateBangkok',to_char(v_today at time zone 'Asia/Bangkok','YYYY-MM-DD'));
 v_result=v_result||jsonb_build_object('cashToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='CASH'),0)::numeric(20,2)::text,'promptpayToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='PROMPTPAY'),0)::numeric(20,2)::text);
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_top from(select i.product_id as "productId",i.product_name_snapshot as name,i.barcode_snapshot as barcode,sum(i.quantity::bigint) as quantity,sum(i.line_total)::numeric(20,2)::text as net from public.sale_items i join public.sales s on s.org_id=i.org_id and s.id=i.sale_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_month and s.completed_at<v_next group by i.product_id,i.product_name_snapshot,i.barcode_snapshot order by sum(i.quantity::bigint) desc,i.product_id,i.product_name_snapshot limit 5)t;
 return v_result||jsonb_build_object('topProducts',v_top);
end;$$;
revoke all on function public.report_data(text,timestamptz,timestamptz,text,uuid,integer,integer),public.report_cashiers(),public.dashboard_summary() from public,anon;
grant execute on function public.report_data(text,timestamptz,timestamptz,text,uuid,integer,integer),public.report_cashiers(),public.dashboard_summary() to authenticated;
notify pgrst,'reload schema';

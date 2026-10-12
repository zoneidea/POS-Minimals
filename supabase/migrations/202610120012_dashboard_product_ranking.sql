-- Group rankings by immutable product ID; use the latest sold snapshot label, never current master data.
create or replace function public.dashboard_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_today timestamptz;v_month timestamptz;v_next timestamptz;v_result jsonb;v_top jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id)='OWNER';
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 v_today=date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
 v_month=date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';v_next=(date_trunc('day',now() at time zone 'Asia/Bangkok')+interval '1 day') at time zone 'Asia/Bangkok';
 select jsonb_build_object('todaySales',coalesce(sum(total_amount) filter(where status='COMPLETED' and completed_at>=v_today),0)::numeric(20,2)::text,'monthSales',coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'todayBills',count(*) filter(where status='COMPLETED' and completed_at>=v_today),'todayVoids',count(*) filter(where status='VOIDED' and completed_at>=v_today)) into v_result from public.sales where org_id=v_org and completed_at>=v_month and completed_at<v_next;
 v_result=v_result||jsonb_build_object('lowStockCount',(select count(*) from public.products where org_id=v_org and deleted_at is null and quantity_on_hand<=5),'dateBangkok',to_char(v_today at time zone 'Asia/Bangkok','YYYY-MM-DD'));
 v_result=v_result||jsonb_build_object('cashToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='CASH'),0)::numeric(20,2)::text,'promptpayToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='PROMPTPAY'),0)::numeric(20,2)::text);
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_top from(select i.product_id as "productId",(array_agg(i.product_name_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as name,(array_agg(i.barcode_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as barcode,sum(i.quantity::bigint) as quantity,sum(i.line_total)::numeric(20,2)::text as net from public.sale_items i join public.sales s on s.org_id=i.org_id and s.id=i.sale_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_month and s.completed_at<v_next group by i.product_id order by sum(i.quantity::bigint) desc,i.product_id limit 5)t;
 return v_result||jsonb_build_object('topProducts',v_top);
end;$$;
notify pgrst,'reload schema';

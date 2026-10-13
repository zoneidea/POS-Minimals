-- Additive read-path optimization; no historical migration/checksum edits.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create index sale_items_product_sales on public.sale_items(org_id,product_id,sale_id);
-- Reuse the extension's existing namespace when a host already enabled it elsewhere.
do $$ declare v_schema text;begin
 select n.nspname into v_schema from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 execute format('create index products_active_name_search on public.products using gin(lower(name) %I.gin_trgm_ops) where deleted_at is null',v_schema);
 execute format('create index products_active_barcode_search on public.products using gin(lower(barcode) %I.gin_trgm_ops) where deleted_at is null',v_schema);
end;$$;
create index products_active_category_list on public.products(org_id,category_id,name,id) where deleted_at is null;
create or replace function public.list_pos_products(p_page integer default 1,p_limit integer default 10,
 p_search text default '',p_barcode text default null,p_category_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_where text=' from public.products where org_id=$1 and deleted_at is null';
 v_pattern text;v_total bigint;v_rows jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE'
 and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 100
 or p_search is null or char_length(p_search)>200 or (p_barcode is not null and char_length(p_barcode) not between 1 and 100)
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_category_id is not null then v_where=v_where||' and category_id=$2';end if;
 if p_barcode is not null then v_where=v_where||' and barcode=$3';end if;
 if p_search<>'' then
 -- LIKE retains literal substring semantics, including %, _ and backslash.
 v_pattern='%'||replace(replace(replace(lower(p_search),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%';
 v_where=v_where||' and (lower(name) like $4 or lower(barcode) like $4)';
 end if;
 execute 'select count(*)'||v_where into v_total using v_org,p_category_id,p_barcode,v_pattern;
 execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''barcode'',barcode,''categoryId'',category_id,''salePrice'',sale_price::text,''quantityOnHand'',quantity_on_hand,''rowVersion'',row_version,''imageUrl'',null,''imagePath'',image_path) order by name,id),''[]''::jsonb) from (select id,name,barcode,category_id,sale_price,quantity_on_hand,row_version,image_path'||v_where||' order by name,id offset $5 limit $6) paged'
 into v_rows using v_org,p_category_id,p_barcode,v_pattern,(p_page-1)*p_limit,p_limit;
 return jsonb_build_object('items',v_rows,'total',v_total,'page',p_page,'limit',p_limit);
end;$$;
create or replace function public.dashboard_product_rankings(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_from timestamptz;v_to timestamptz=now();v_top jsonb;v_slow jsonb;v_idle jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id)='OWNER';
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_days is null or p_days not in (7,15,30) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 v_from=(date_trunc('day',v_to at time zone 'Asia/Bangkok')-make_interval(days=>p_days-1)) at time zone 'Asia/Bangkok';
 with sold as(select i.product_id,(array_agg(i.product_name_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as name,(array_agg(i.barcode_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as barcode,sum(i.quantity::bigint) as quantity from public.sale_items i join public.sales s on s.id=i.sale_id and s.org_id=i.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_from and s.completed_at<=v_to group by i.product_id)
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_top from(select product_id as "productId",name,barcode,quantity from sold order by quantity desc,product_id limit 5)t;
 with sold as(select i.product_id,sum(i.quantity::bigint) as quantity,max(s.completed_at) as last_sale from public.sale_items i join public.sales s on s.id=i.sale_id and s.org_id=i.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_from and s.completed_at<=v_to group by i.product_id)
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_slow from(select p.id as "productId",p.name,p.barcode,coalesce(s.quantity,0) as quantity,p.quantity_on_hand as "stockQuantity" from public.products p left join sold s on s.product_id=p.id where p.org_id=v_org and p.deleted_at is null and p.quantity_on_hand>0 order by coalesce(s.quantity,0),s.last_sale asc nulls first,p.created_at,p.id limit 5)t;
 -- User-defined span: product creation through latest completed sale, or today when never sold.
 with last_sales as materialized (
 select i.product_id,max(s.completed_at) as last_sale
 from public.sale_items i join public.sales s on s.id=i.sale_id and s.org_id=i.org_id
 join public.products p on p.id=i.product_id and p.org_id=i.org_id
 where i.org_id=v_org and p.deleted_at is null and p.quantity_on_hand>0
 and s.status='COMPLETED' and s.completed_at<=v_to and s.completed_at>=p.created_at
 group by i.product_id),
 candidates as(
 select p.id,p.name,p.barcode,p.quantity_on_hand,p.created_at,l.last_sale
 from public.products p left join last_sales l on l.product_id=p.id
 where p.org_id=v_org and p.deleted_at is null and p.quantity_on_hand>0),
 aged as(select *,(coalesce(last_sale,v_to) at time zone 'Asia/Bangkok')::date-(created_at at time zone 'Asia/Bangkok')::date as span_days from candidates where created_at<=v_to)
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_idle from(select id as "productId",name,barcode,quantity_on_hand as "stockQuantity",span_days as "idleDays",to_char(created_at at time zone 'Asia/Bangkok','YYYY-MM-DD') as "sinceDate",to_char(last_sale at time zone 'Asia/Bangkok','YYYY-MM-DD') as "lastSaleDate" from aged where span_days>=p_days order by span_days desc,quantity_on_hand desc,id limit 5)t;
 return jsonb_build_object('days',p_days,'fromBangkok',to_char(v_from at time zone 'Asia/Bangkok','YYYY-MM-DD'),'toBangkok',to_char(v_to at time zone 'Asia/Bangkok','YYYY-MM-DD'),'topProducts',v_top,'slowProducts',v_slow,'idleProducts',v_idle);
end;$$;
revoke all on function public.dashboard_product_rankings(integer) from public,anon;
grant execute on function public.dashboard_product_rankings(integer) to authenticated;
create or replace function public.dashboard_summary(p_include_top boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_org uuid;v_today timestamptz;v_month timestamptz;v_next timestamptz;v_result jsonb;v_top jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id)='OWNER';
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 v_today=date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
 v_month=date_trunc('month',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';v_next=(date_trunc('day',now() at time zone 'Asia/Bangkok')+interval '1 day') at time zone 'Asia/Bangkok';
 select jsonb_build_object('todaySales',coalesce(sum(total_amount) filter(where status='COMPLETED' and completed_at>=v_today),0)::numeric(20,2)::text,'monthSales',coalesce(sum(total_amount) filter(where status='COMPLETED'),0)::numeric(20,2)::text,'todayBills',count(*) filter(where status='COMPLETED' and completed_at>=v_today),'todayVoids',count(*) filter(where status='VOIDED' and completed_at>=v_today)) into v_result from public.sales where org_id=v_org and completed_at>=v_month and completed_at<v_next;
 v_result=v_result||jsonb_build_object('lowStockCount',(select count(*) from public.products where org_id=v_org and deleted_at is null and quantity_on_hand<=5),'dateBangkok',to_char(v_today at time zone 'Asia/Bangkok','YYYY-MM-DD'));
 v_result=v_result||jsonb_build_object('cashToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='CASH'),0)::numeric(20,2)::text,'promptpayToday',coalesce((select sum(p.amount) from public.payments p join public.sales s on s.id=p.sale_id and s.org_id=p.org_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_today and s.completed_at<v_next and p.method='PROMPTPAY'),0)::numeric(20,2)::text);
 v_top='[]'::jsonb;
 if p_include_top then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_top from(select i.product_id as "productId",(array_agg(i.product_name_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as name,(array_agg(i.barcode_snapshot order by s.completed_at desc,s.id desc,i.id desc))[1] as barcode,sum(i.quantity::bigint) as quantity,sum(i.line_total)::numeric(20,2)::text as net from public.sale_items i join public.sales s on s.org_id=i.org_id and s.id=i.sale_id where s.org_id=v_org and s.status='COMPLETED' and s.completed_at>=v_month and s.completed_at<v_next group by i.product_id order by sum(i.quantity::bigint) desc,i.product_id limit 5)t;
 end if;
 return v_result||jsonb_build_object('topProducts',v_top);
end;$$;
revoke all on function public.dashboard_summary(boolean) from public,anon;
grant execute on function public.dashboard_summary(boolean) to authenticated;
create or replace function public.dashboard_summary() returns jsonb language sql stable security definer set search_path='' as $$
 select public.dashboard_summary(true);
$$;
notify pgrst,'reload schema';

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
 with candidates as(
 select p.id,p.name,p.barcode,p.quantity_on_hand,p.created_at,
 (select max(s.completed_at) from public.sale_items i join public.sales s on s.id=i.sale_id and s.org_id=i.org_id where i.org_id=v_org and i.product_id=p.id and s.status='COMPLETED' and s.completed_at<=v_to and s.completed_at>=p.created_at) as last_sale
 from public.products p where p.org_id=v_org and p.deleted_at is null and p.quantity_on_hand>0),
 aged as(select *,(coalesce(last_sale,v_to) at time zone 'Asia/Bangkok')::date-(created_at at time zone 'Asia/Bangkok')::date as span_days from candidates where created_at<=v_to)
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into v_idle from(select id as "productId",name,barcode,quantity_on_hand as "stockQuantity",span_days as "idleDays",to_char(created_at at time zone 'Asia/Bangkok','YYYY-MM-DD') as "sinceDate",to_char(last_sale at time zone 'Asia/Bangkok','YYYY-MM-DD') as "lastSaleDate" from aged where span_days>=p_days order by span_days desc,quantity_on_hand desc,id limit 5)t;
 return jsonb_build_object('days',p_days,'fromBangkok',to_char(v_from at time zone 'Asia/Bangkok','YYYY-MM-DD'),'toBangkok',to_char(v_to at time zone 'Asia/Bangkok','YYYY-MM-DD'),'topProducts',v_top,'slowProducts',v_slow,'idleProducts',v_idle);
end;$$;
revoke all on function public.dashboard_product_rankings(integer) from public,anon;
grant execute on function public.dashboard_product_rankings(integer) to authenticated;
notify pgrst,'reload schema';

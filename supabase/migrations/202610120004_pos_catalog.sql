-- Restricted read projection: employees never receive inventory cost/audit columns.
create function public.list_pos_products(p_page integer default 1,p_limit integer default 10,
 p_search text default '',p_barcode text default null,p_category_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role in ('OWNER','EMPLOYEE') and m.status='ACTIVE'
 and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN'; end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 100
 or p_search is null or char_length(p_search)>200 or (p_barcode is not null and char_length(p_barcode) not between 1 and 100)
 then raise sqlstate 'PT400' using message='VALIDATION_ERROR'; end if;
 with filtered as materialized (
  select p.id,p.name,p.barcode,p.category_id,p.sale_price,p.quantity_on_hand,p.row_version
  from public.products p where p.org_id=v_org and p.deleted_at is null
  and (p_category_id is null or p.category_id=p_category_id)
  and (p_barcode is null or p.barcode=p_barcode)
  and (p_search='' or position(lower(p_search) in lower(p.name))>0 or position(lower(p_search) in lower(p.barcode))>0)
 ), paged as (select * from filtered order by name,id offset (p_page-1)*p_limit limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'name',name,'barcode',barcode,'categoryId',category_id,'salePrice',sale_price::text,
  'quantityOnHand',quantity_on_hand,'rowVersion',row_version,'imageUrl',null) order by name,id) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',p_page,'limit',p_limit) into v_result;
 return v_result;
end;
$$;
revoke all on function public.list_pos_products(integer,integer,text,text,uuid) from public,anon;
grant execute on function public.list_pos_products(integer,integer,text,text,uuid) to authenticated;

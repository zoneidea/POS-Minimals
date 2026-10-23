-- API-only RPC. No anonymous or authenticated Supabase caller can execute it.
-- Rate counters commit even when the inner ordering transaction rejects a request.
create function public.restaurant_guest_request(p_hash text,p_client text,p_operation text,p_input jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.restaurant_guest_access;b public.restaurant_bills;org uuid;mode text;n integer;rows jsonb;q jsonb;item jsonb;r public.restaurant_rounds;groups jsonb;products jsonb;categories jsonb;store text;k text;hits int;minute timestamptz=date_trunc('minute',clock_timestamp());err text;errcode text;
begin
 if p_hash is null or p_hash!~'^[0-9a-f]{64}$' or p_client is null or p_client!~'^[0-9a-f]{64}$' or p_request is null or p_operation is null or p_operation not in ('menu','order','send') then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR');end if;
 delete from private.restaurant_guest_limits where window_at<now()-interval '1 day';
 k='client:'||p_client;
 insert into private.restaurant_guest_limits(key,window_at,hits) values(k,minute,1) on conflict(key) do update set window_at=excluded.window_at,hits=case when restaurant_guest_limits.window_at=excluded.window_at then restaurant_guest_limits.hits+1 else 1 end returning restaurant_guest_limits.hits into hits;
 if hits>180 then return jsonb_build_object('ok',false,'code','RATE_LIMITED');end if;
 select * into a from public.restaurant_guest_access where token_hash=p_hash;
 if not found or a.revoked_at is not null or a.expires_at<=now() then return jsonb_build_object('ok',false,'code','GUEST_ACCESS_EXPIRED');end if;
 k='access:'||a.id||case when p_operation='send' then ':send' else ':read' end;
 insert into private.restaurant_guest_limits(key,window_at,hits) values(k,minute,1) on conflict(key) do update set window_at=excluded.window_at,hits=case when restaurant_guest_limits.window_at=excluded.window_at then restaurant_guest_limits.hits+1 else 1 end returning restaurant_guest_limits.hits into hits;
 if hits>(case when p_operation='send' then 6 else 120 end) then return jsonb_build_object('ok',false,'code','RATE_LIMITED');end if;
 begin
 org=a.org_id;
 if not exists(select 1 from public.organizations where id=org and status='ACTIVE' and deleted_at is null) then raise sqlstate 'PT410' using message='GUEST_ACCESS_EXPIRED';end if;
 select store_mode,store_name into mode,store from public.store_settings where org_id=org and deleted_at is null for share;
 if mode is distinct from 'RESTAURANT' then raise sqlstate 'PT410' using message='GUEST_ACCESS_EXPIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':restaurant',0));
 select * into b from public.restaurant_bills where org_id=org and id=a.bill_id for update;
 -- Recheck after waiting for concurrent checkout/revocation.
 select * into a from public.restaurant_guest_access where id=a.id;
 if b.status is distinct from 'OPEN' or a.revoked_at is not null or a.expires_at<=clock_timestamp() then raise sqlstate 'PT410' using message='GUEST_ACCESS_EXPIRED';end if;
 if p_operation='order' then return jsonb_build_object('ok',true,'data',private.restaurant_guest_order(org,b.id));end if;
 if p_operation='menu' then
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.sort_order,c.name),'[]') into categories from public.categories c where c.org_id=org and c.deleted_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'categoryId',p.category_id,'salePrice',p.sale_price::text,'available',not p.track_stock or p.quantity_on_hand>0,'imagePath',p.image_path) order by p.name),'[]') into products from public.products p where p.org_id=org and p.deleted_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'minChoices',g.min_choices,'maxChoices',g.max_choices,'enabled',true,'version',g.row_version,
 'productIds',(select coalesce(jsonb_agg(pg.product_id),'[]') from public.cafe_product_groups pg join public.products p on p.org_id=pg.org_id and p.id=pg.product_id and p.deleted_at is null where pg.org_id=org and pg.group_id=g.id),
 'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price::text,'enabled',true,'isDefault',o.is_default) order by o.position,o.id),'[]') from public.cafe_options o where o.org_id=org and o.group_id=g.id and o.enabled and o.deleted_at is null)) order by g.name),'[]') into groups from public.cafe_option_groups g where g.org_id=org and g.enabled and g.deleted_at is null;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('storeName',store,'tableName',b.table_name,'expiresAt',a.expires_at,'categories',categories,'products',products,'groups',groups,'order',private.restaurant_guest_order(org,b.id)));
 end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['key','version','items'])<>'{}' or not(p_input ?& array['key','version','items']) or coalesce(p_input->>'key','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(p_input->>'version','')!~'^[1-9][0-9]{0,15}$' or jsonb_typeof(p_input->'version')<>'number' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into r from public.restaurant_rounds where id=(p_input->>'key')::uuid;
 if found then
 if r.org_id<>org or r.bill_id<>b.id or r.guest_access_id is distinct from a.id or r.input_json<>p_input then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;
 return jsonb_build_object('ok',true,'data',jsonb_build_object('roundId',r.id,'roundNumber',r.number,'replayed',true,'order',private.restaurant_guest_order(org,b.id)));
 end if;
 if b.version<>(p_input->>'version')::bigint then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 rows=p_input->'items';if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 50 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 for item in select value from jsonb_array_elements(rows) loop
 if jsonb_typeof(item)<>'object' or (item-array['productId','lineId','quantity','optionIds','note','expectedUnitPrice'])<>'{}' or not(item ?& array['productId','lineId','quantity','optionIds','note','expectedUnitPrice']) or coalesce(item->>'quantity','')!~'^[1-9][0-9]?$' or (item->>'quantity')::int>20 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 end loop;
 q=private.quote_cafe_scoped(org,rows,'0.00',null,false);
 if exists(select 1 from jsonb_array_elements(rows) i join jsonb_array_elements(q->'items') x on x->>'lineId'=i->>'lineId' where coalesce(i->>'expectedUnitPrice','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' or i->>'expectedUnitPrice'<>x->>'unitPrice') then raise sqlstate 'PT409' using message='CART_STALE';end if;
 perform 1 from public.products p where p.org_id=org and p.id in(select (i->>'productId')::uuid from jsonb_array_elements(q->'items') i) order by p.id for update;
 if exists(select 1 from public.products p where p.org_id=org and p.deleted_at is not null and p.id in(select (i->>'productId')::uuid from jsonb_array_elements(q->'items') i)) then raise sqlstate 'PT409' using message='PRODUCT_UNAVAILABLE';end if;
 if (private.restaurant_bill_json(org,b.id)->>'totalAmount')::numeric+(q->>'totalAmount')::numeric>999999999999.99 then raise sqlstate 'PT400' using message='AMOUNT_OUT_OF_RANGE';end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.restaurant_rounds where org_id=org and bill_id=b.id and cancelled_at is null)+jsonb_array_length(rows)>200 then raise sqlstate 'PT409' using message='ORDER_LIMIT';end if;
 select coalesce(max(number),0)+1 into n from public.restaurant_rounds where org_id=org and bill_id=b.id;if n>200 then raise sqlstate 'PT409' using message='ORDER_LIMIT';end if;
 insert into public.restaurant_rounds(id,org_id,bill_id,number,input_json,items,created_by,source,guest_access_id) values((p_input->>'key')::uuid,org,b.id,n,p_input,(select jsonb_agg(i||jsonb_build_object('lineId',gen_random_uuid())) from jsonb_array_elements(q->'items') i),null,'GUEST',a.id) returning * into r;
 update public.restaurant_bills set version=version+1 where org_id=org and id=b.id;
 insert into public.restaurant_guest_activity_logs(org_id,access_id,round_id,request_id) values(org,a.id,r.id,p_request);
 return jsonb_build_object('ok',true,'data',jsonb_build_object('roundId',r.id,'roundNumber',r.number,'replayed',false,'order',private.restaurant_guest_order(org,b.id)));
 exception when sqlstate 'PT400' or sqlstate 'PT403' or sqlstate 'PT404' or sqlstate 'PT409' or sqlstate 'PT410' then get stacked diagnostics err=message_text;return jsonb_build_object('ok',false,'code',err);
 end;
end;$$;
revoke all on function public.restaurant_guest_request(text,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.restaurant_guest_request(text,text,text,jsonb,uuid) to service_role;
notify pgrst,'reload schema';

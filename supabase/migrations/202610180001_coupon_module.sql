-- Demo entitlement and fixed-value coupons. No money is collected by the demo purchase.
create table public.org_modules (
 org_id uuid not null references public.organizations(id), module_code text not null check(module_code='coupons'),
 enabled boolean not null default true, source text not null default 'DEMO' check(source='DEMO'),
 acquired_at timestamptz not null default now(), acquired_by uuid not null references auth.users(id), primary key(org_id,module_code)
);
create table public.coupons (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),
 name text not null check(char_length(name) between 1 and 100),code text not null check(code ~ '^[A-Z0-9_-]{3,32}$'),
 amount numeric(14,2) not null check(amount>0),starts_on date not null,ends_on date not null check(ends_on>=starts_on),
 max_uses integer not null check(max_uses>0),used_count integer not null default 0 check(used_count>=0 and used_count<=max_uses),
 show_on_receipt boolean not null default false,row_version bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(org_id,code),unique(org_id,id)
);
create table public.coupon_redemptions (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,sale_id uuid not null,coupon_id uuid not null,
 code_snapshot text not null,name_snapshot text not null,discount_amount numeric(14,2) not null check(discount_amount>=0),
 created_at timestamptz not null default now(),reversed_at timestamptz,
 unique(org_id,sale_id),foreign key(org_id,sale_id) references public.sales(org_id,id),foreign key(org_id,coupon_id) references public.coupons(org_id,id)
);
create table public.coupon_events (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),coupon_id uuid,
 sale_id uuid,action text not null check(action in ('CREATE','UPDATE','DELETE','REDEEM','REVERSE')),quantity_before integer,quantity_after integer,
 before_json jsonb,after_json jsonb,actor_user_id uuid not null references auth.users(id),request_id uuid not null,created_at timestamptz not null default now(),
 foreign key(org_id,coupon_id) references public.coupons(org_id,id),foreign key(org_id,sale_id) references public.sales(org_id,id)
);
create index coupon_redemptions_report on public.coupon_redemptions(org_id,created_at desc,id);
create index coupon_events_history on public.coupon_events(org_id,created_at desc);
create index coupons_active on public.coupons(org_id,ends_on) where deleted_at is null;
alter table public.org_modules enable row level security;alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;alter table public.coupon_events enable row level security;
revoke all on public.org_modules,public.coupons,public.coupon_redemptions,public.coupon_events from public,anon,authenticated;
grant select on public.org_modules,public.coupons,public.coupon_redemptions,public.coupon_events to authenticated;
create policy module_read on public.org_modules for select to authenticated using(private.current_org_role(org_id) in ('OWNER','EMPLOYEE','ACCOUNTANT'));
create policy coupon_read on public.coupons for select to authenticated using(private.current_org_role(org_id)='OWNER' and exists(select 1 from public.org_modules m where m.org_id=coupons.org_id and m.module_code='coupons' and m.enabled));
create policy redemption_read on public.coupon_redemptions for select to authenticated using(private.current_org_role(org_id) in ('OWNER','ACCOUNTANT') and exists(select 1 from public.org_modules m where m.org_id=coupon_redemptions.org_id and m.module_code='coupons' and m.enabled));
create policy coupon_event_read on public.coupon_events for select to authenticated using(private.current_org_role(org_id)='OWNER');

create function private.coupon_org(p_roles text[],p_require_module boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select m.org_id into org from public.organization_members m join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role=any(p_roles) and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_require_module then
  perform 1 from public.org_modules where org_id=org and module_code='coupons' and enabled for share;
  if not found then raise sqlstate 'PT403' using message='MODULE_NOT_ACTIVE';end if;
 end if;
 return org;
end;$$;
revoke all on function private.coupon_org(text[],boolean) from public,anon,authenticated;
create function public.demo_purchase_coupons(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;begin
 org=private.coupon_org(array['OWNER'],false);
 if p_request is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 insert into public.org_modules(org_id,module_code,acquired_by) values(org,'coupons',auth.uid()) on conflict(org_id,module_code) do nothing;
 if found then insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'MODULE_DEMO_PURCHASED',org,p_request);end if;
 return jsonb_build_object('coupons',exists(select 1 from public.org_modules where org_id=org and module_code='coupons' and enabled));
end;$$;
create function private.coupon_json(c public.coupons) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',c.id,'name',c.name,'code',c.code,'amount',c.amount::text,'startsOn',c.starts_on,'endsOn',c.ends_on,'maxUses',c.max_uses,'usedCount',c.used_count,'showOnReceipt',c.show_on_receipt,'version',c.row_version)
$$;
revoke all on function private.coupon_json(public.coupons) from public,anon,authenticated;
create function public.list_coupons(p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;n bigint;rows jsonb;begin
 org=private.coupon_org(array['OWNER']);
 if p_page is null or p_page<1 or p_page>100000 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select count(*) into n from public.coupons where org_id=org and deleted_at is null;
 select coalesce(jsonb_agg(private.coupon_json(t)),'[]'::jsonb) into rows from(select * from public.coupons where org_id=org and deleted_at is null order by created_at desc,id limit 10 offset (p_page-1)*10)t;
 return jsonb_build_object('items',rows,'total',n,'page',p_page,'limit',10);
end;$$;
create function public.manage_coupon(p_action text,p_id uuid,p_input jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;c public.coupons;old_remaining integer;before_data jsonb;begin
 org=private.coupon_org(array['OWNER']);
 if p_request is null or p_action not in ('CREATE','UPDATE','DELETE') or p_input is null or jsonb_typeof(p_input)<>'object' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_action<>'CREATE' then
  select * into c from public.coupons where id=p_id and org_id=org and deleted_at is null for update;
  if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
  if coalesce(p_input->>'version','')!~'^[1-9][0-9]{0,15}$' or c.row_version<>(p_input->>'version')::bigint then raise sqlstate 'PT409' using message='COUPON_CHANGED';end if;
  old_remaining=c.max_uses-c.used_count;before_data=private.coupon_json(c);
 end if;
 if p_action='DELETE' then
  if (p_input-'version')<>'{}'::jsonb then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
  update public.coupons set deleted_at=now(),updated_at=now(),row_version=row_version+1 where id=c.id returning * into c;
 else
  if not(p_input ?& array['name','code','amount','startsOn','endsOn','maxUses','showOnReceipt'])
   or (p_input-array['name','code','amount','startsOn','endsOn','maxUses','showOnReceipt','version'])<>'{}'::jsonb
   or char_length(btrim(coalesce(p_input->>'name',''))) not between 1 and 100
   or coalesce(p_input->>'code','')!~'^[A-Z0-9_-]{3,32}$' or coalesce(p_input->>'amount','')!~'^(0|[1-9][0-9]{0,11})\.[0-9]{2}$'
   or (p_input->>'amount')::numeric<=0 or coalesce(p_input->>'startsOn','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(p_input->>'endsOn','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or (p_input->>'endsOn')::date<(p_input->>'startsOn')::date or jsonb_typeof(p_input->'maxUses')<>'number'
   or coalesce(p_input->>'maxUses','')!~'^[1-9][0-9]{0,9}$' or (p_input->>'maxUses')::numeric>2147483647 or jsonb_typeof(p_input->'showOnReceipt')<>'boolean'
   then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
  if p_action='CREATE' then
   insert into public.coupons(org_id,name,code,amount,starts_on,ends_on,max_uses,show_on_receipt) values(org,btrim(p_input->>'name'),p_input->>'code',(p_input->>'amount')::numeric,(p_input->>'startsOn')::date,(p_input->>'endsOn')::date,(p_input->>'maxUses')::integer,(p_input->>'showOnReceipt')::boolean) returning * into c;
  else
   if (p_input->>'maxUses')::integer<c.used_count then raise sqlstate 'PT409' using message='COUPON_LIMIT_BELOW_USAGE';end if;
   update public.coupons set name=btrim(p_input->>'name'),code=p_input->>'code',amount=(p_input->>'amount')::numeric,starts_on=(p_input->>'startsOn')::date,ends_on=(p_input->>'endsOn')::date,max_uses=(p_input->>'maxUses')::integer,show_on_receipt=(p_input->>'showOnReceipt')::boolean,row_version=row_version+1,updated_at=now() where id=c.id returning * into c;
  end if;
 end if;
 insert into public.coupon_events(org_id,coupon_id,action,quantity_before,quantity_after,before_json,after_json,actor_user_id,request_id) values(org,c.id,p_action,old_remaining,c.max_uses-c.used_count,before_data,private.coupon_json(c)||jsonb_build_object('deletedAt',c.deleted_at),auth.uid(),p_request);
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'COUPON_'||p_action,c.id,p_request);
 return private.coupon_json(c);
exception when unique_violation then raise sqlstate 'PT409' using message='COUPON_CODE_EXISTS';
 when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then raise sqlstate 'PT400' using message='VALIDATION_ERROR';
end;$$;
create function public.quote_coupon_sale(p_items jsonb,p_discount text,p_coupon_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;c public.coupons;q jsonb;d numeric;today date=(now() at time zone 'Asia/Bangkok')::date;begin
 q=public.quote_cash_sale(p_items,p_discount);
 if p_coupon_code is null then return q||jsonb_build_object('manualDiscountAmount',p_discount,'couponDiscountAmount','0.00');end if;
 org=private.coupon_org(array['OWNER','EMPLOYEE']);
 select * into c from public.coupons where org_id=org and code=p_coupon_code and deleted_at is null;
 if not found or today<c.starts_on or today>c.ends_on or c.used_count>=c.max_uses then raise sqlstate 'PT409' using message='COUPON_UNAVAILABLE';end if;
 d=least(c.amount,(q->>'subtotalAmount')::numeric-p_discount::numeric);
 if d<=0 then raise sqlstate 'PT409' using message='COUPON_NO_DISCOUNT';end if;
 q=public.quote_cash_sale(p_items,(p_discount::numeric+d)::numeric(14,2)::text);
 return q||jsonb_build_object('manualDiscountAmount',p_discount,'couponDiscountAmount',d::numeric(14,2)::text,'couponCode',c.code);
end;$$;
-- Preserve existing cash/gateway calculations in private cores; only coupon orchestration is new.
alter function public.checkout_cash_sale(jsonb,uuid,uuid,text) set schema private;
alter function private.checkout_cash_sale(jsonb,uuid,uuid,text) rename to checkout_cash_base;
revoke all on function private.checkout_cash_base(jsonb,uuid,uuid,text) from public,anon,authenticated,service_role;
alter function private.checkout_gateway_core(jsonb,uuid,uuid,text) rename to checkout_gateway_base;
revoke all on function private.checkout_gateway_base(jsonb,uuid,uuid,text) from public,anon,authenticated,service_role;
create function private.checkout_coupon_sale(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text,p_gateway boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;c public.coupons;q jsonb;result jsonb;existing public.sales;adjusted jsonb=p_input;sid uuid;offers jsonb;begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 if p_input ? 'couponCode' then
  perform pg_advisory_xact_lock(hashtextextended(org::text||':sale:'||p_key::text,0));
  select * into existing from public.sales where org_id=org and request_key=p_key;
  if found then
   if existing.input_json<>(p_input||jsonb_build_object('actor',auth.uid())) then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;
   return existing.result_json||jsonb_build_object('replayed',true);
  end if;
  perform private.coupon_org(array['OWNER','EMPLOYEE']);
  -- Same product lock order as paid Gateway finalization, then the coupon lock.
  perform 1 from public.products p where p.org_id=org and p.id in(select (value->>'productId')::uuid from jsonb_array_elements(p_input->'items')) order by p.id for update;
  select * into c from public.coupons where org_id=org and code=p_input->>'couponCode' and deleted_at is null for update;
  if not found then raise sqlstate 'PT409' using message='COUPON_UNAVAILABLE';end if;
  q=public.quote_coupon_sale((select jsonb_agg(jsonb_build_object('productId',value->>'productId','quantity',(value->>'quantity')::integer)) from jsonb_array_elements(p_input->'items')),p_input->>'discountAmount',p_input->>'couponCode');
  adjusted=jsonb_set(p_input-'couponCode','{discountAmount}',q->'discountAmount');
 end if;
 if p_gateway then result=private.checkout_gateway_base(adjusted,p_key,p_request_id,p_identity_cipher);
 else result=private.checkout_cash_base(adjusted,p_key,p_request_id,p_identity_cipher);end if;
 if (result->>'replayed')::boolean then return result;end if;
 sid=(result->>'saleId')::uuid;
 if c.id is not null then
  insert into public.coupon_redemptions(org_id,sale_id,coupon_id,code_snapshot,name_snapshot,discount_amount) values(org,sid,c.id,c.code,c.name,(q->>'couponDiscountAmount')::numeric);
  update public.coupons set used_count=used_count+1,row_version=row_version+1,updated_at=now() where id=c.id;
  insert into public.coupon_events(org_id,coupon_id,sale_id,action,quantity_before,quantity_after,actor_user_id,request_id) values(org,c.id,sid,'REDEEM',c.max_uses-c.used_count,c.max_uses-c.used_count-1,auth.uid(),p_request_id);
  result=jsonb_set(result,'{receipt,coupon}',jsonb_build_object('code',c.code,'name',c.name,'amount',q->>'couponDiscountAmount'));
  update public.sales set input_json=p_input||jsonb_build_object('actor',auth.uid()) where id=sid;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'amount',amount::text,'endsOn',ends_on) order by ends_on,code),'[]'::jsonb) into offers from public.coupons
 where org_id=org and deleted_at is null and show_on_receipt and starts_on<=(now() at time zone 'Asia/Bangkok')::date and ends_on>=(now() at time zone 'Asia/Bangkok')::date and used_count<max_uses and exists(select 1 from public.org_modules where org_id=org and module_code='coupons' and enabled);
 result=jsonb_set(result,'{receipt,couponOffers}',offers);
 update public.sales set result_json=result-'replayed' where id=sid;
 return result;
end;$$;
revoke all on function private.checkout_coupon_sale(jsonb,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
create function public.checkout_cash_sale(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text) returns jsonb language sql security definer set search_path='' as $$ select private.checkout_coupon_sale(p_input,p_key,p_request_id,p_identity_cipher,false) $$;
create function private.checkout_gateway_core(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text) returns jsonb language sql security definer set search_path='' as $$ select private.checkout_coupon_sale(p_input,p_key,p_request_id,p_identity_cipher,true) $$;
revoke all on function private.checkout_gateway_core(jsonb,uuid,uuid,text) from public,anon,authenticated,service_role;
-- A successful void returns one coupon use; repeated voids cannot return it twice.
create function private.reverse_sale_coupon() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.coupon_redemptions;c public.coupons;begin
 select * into r from public.coupon_redemptions where org_id=new.org_id and sale_id=new.sale_id and reversed_at is null for update;
 if found then
  select * into c from public.coupons where id=r.coupon_id and org_id=new.org_id for update;
  update public.coupons set used_count=used_count-1,row_version=row_version+1,updated_at=now() where id=c.id;
  update public.coupon_redemptions set reversed_at=now() where id=r.id;
  insert into public.coupon_events(org_id,coupon_id,sale_id,action,quantity_before,quantity_after,actor_user_id,request_id) values(new.org_id,c.id,new.sale_id,'REVERSE',c.max_uses-c.used_count,c.max_uses-c.used_count+1,new.actor_user_id,new.request_id);
 end if;return new;
end;$$;
revoke all on function private.reverse_sale_coupon() from public,anon,authenticated;
create trigger sale_coupon_void after insert on public.sale_void_logs for each row execute function private.reverse_sale_coupon();
create function public.coupon_usage_report(p_from timestamptz,p_to timestamptz,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;n bigint;rows jsonb;summary jsonb;begin
 org=private.coupon_org(array['OWNER','ACCOUNTANT']);
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' or p_page is null or p_page<1 or p_page>100000 then raise sqlstate 'PT400' using message='INVALID_RANGE';end if;
 select count(*),jsonb_build_object('uses',count(*) filter(where s.status='COMPLETED'),'discount',coalesce(sum(r.discount_amount) filter(where s.status='COMPLETED'),0)::numeric(24,2)::text) into n,summary from public.coupon_redemptions r join public.sales s on s.org_id=r.org_id and s.id=r.sale_id where r.org_id=org and s.completed_at>=p_from and s.completed_at<p_to;
 select coalesce(jsonb_agg(t.row),'[]'::jsonb) into rows from(select jsonb_build_object('id',r.id,'saleNo',s.sale_no,'code',r.code_snapshot,'name',r.name_snapshot,'amount',r.discount_amount::text,'completedAt',s.completed_at,'status',s.status) row from public.coupon_redemptions r join public.sales s on s.org_id=r.org_id and s.id=r.sale_id where r.org_id=org and s.completed_at>=p_from and s.completed_at<p_to order by s.completed_at desc,r.id limit 10 offset (p_page-1)*10)t;
 return jsonb_build_object('items',rows,'total',n,'summary',summary,'page',p_page,'limit',10);
end;$$;
revoke all on function public.demo_purchase_coupons(uuid),public.list_coupons(integer),public.manage_coupon(text,uuid,jsonb,uuid),public.quote_coupon_sale(jsonb,text,text),public.checkout_cash_sale(jsonb,uuid,uuid,text),public.coupon_usage_report(timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.demo_purchase_coupons(uuid),public.list_coupons(integer),public.manage_coupon(text,uuid,jsonb,uuid),public.quote_coupon_sale(jsonb,text,text),public.checkout_cash_sale(jsonb,uuid,uuid,text),public.coupon_usage_report(timestamptz,timestamptz,integer) to authenticated;
notify pgrst,'reload schema';

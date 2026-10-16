create or replace function public.gateway_sales_report(p_from timestamptz,p_to timestamptz,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;rows jsonb;summary jsonb;n bigint;
begin
 select m.org_id into org from public.organization_members m join public.organizations o on o.id=m.org_id where m.user_id=auth.uid() and m.role in ('OWNER','ACCOUNTANT') and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' or p_page<1 or p_page>100000 then raise sqlstate 'PT400' using message='INVALID_RANGE';end if;
 select count(*),jsonb_build_object('gross',coalesce(sum(p.amount),0)::numeric(24,2)::text,'fees',coalesce(sum(round(p.amount * 0.015,2)),0)::numeric(24,2)::text,'net',coalesce(sum(p.amount-round(p.amount * 0.015,2)),0)::numeric(24,2)::text) into n,summary from public.sales s join public.payments p on p.org_id=s.org_id and p.sale_id=s.id where s.org_id=org and s.status='COMPLETED' and p.method='PROMPTPAY' and p.provider_payment_id is not null and s.completed_at>=p_from and s.completed_at<p_to;
 select coalesce(jsonb_agg(t.row),'[]'::jsonb) into rows from (select jsonb_build_object('id',s.id,'saleNo',s.sale_no,'paymentId',p.provider_payment_id,'completedAtUtc',s.completed_at,'gross',p.amount::text,'fee',round(p.amount * 0.015,2)::numeric(14,2)::text,'net',(p.amount-round(p.amount * 0.015,2))::numeric(14,2)::text,'identityCipher',s.identity_cipher) as row from public.sales s join public.payments p on p.org_id=s.org_id and p.sale_id=s.id where s.org_id=org and s.status='COMPLETED' and p.method='PROMPTPAY' and p.provider_payment_id is not null and s.completed_at>=p_from and s.completed_at<p_to order by s.completed_at desc,s.id desc limit 10 offset (p_page-1)*10)t;
 return jsonb_build_object('items',rows,'total',n,'summary',summary,'page',p_page,'limit',10);
end;$$;
revoke all on function public.gateway_sales_report(timestamptz,timestamptz,integer) from public,anon,service_role;
grant execute on function public.gateway_sales_report(timestamptz,timestamptz,integer) to authenticated;

-- Durable lease and provider evidence; no client can write the evidence.
create table public.gateway_sale_voids (
 org_id uuid not null, sale_id uuid not null, payment_id text not null,
 reason text not null check(char_length(reason) between 1 and 500),
 attempt_id uuid not null, lease_until timestamptz not null,
 verified_at timestamptz, actor_user_id uuid not null, request_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(org_id,sale_id), foreign key(org_id,sale_id) references public.sales(org_id,id)
);
alter table public.gateway_sale_voids enable row level security;
revoke all on public.gateway_sale_voids from public,anon,authenticated,service_role;

create function public.prepare_sale_void(p_id uuid,p_reason text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;s public.sales;p public.payments;v public.gateway_sale_voids;attempt uuid=gen_random_uuid();
begin
 select m.org_id into org from public.organization_members m join public.organizations o on o.id=m.org_id where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_id is null or p_request_id is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into s from public.sales where org_id=org and id=p_id for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if s.status='VOIDED' then
  if s.void_reason<>btrim(p_reason) then raise sqlstate 'PT409' using message='ALREADY_VOIDED';end if;
  return jsonb_build_object('orgId',org,'paymentId',null);
 end if;
 select * into p from public.payments where org_id=org and sale_id=p_id;
 if p.provider_payment_id is null then return jsonb_build_object('orgId',org,'paymentId',null);end if;
 select * into v from public.gateway_sale_voids where org_id=org and sale_id=p_id;
 if found and v.reason<>btrim(p_reason) then raise sqlstate 'PT409' using message='VOID_REASON_CONFLICT';end if;
 if v.verified_at is not null then return jsonb_build_object('orgId',org,'paymentId',p.provider_payment_id,'verified',true);end if;
 if (clock_timestamp() at time zone 'Asia/Bangkok')::date<>(s.completed_at at time zone 'Asia/Bangkok')::date or clock_timestamp()<s.completed_at then raise sqlstate 'PT409' using message='VOID_WINDOW_EXPIRED';end if;
 if v.lease_until>clock_timestamp() then raise sqlstate 'PT409' using message='VOID_IN_PROGRESS';end if;
 insert into public.gateway_sale_voids(org_id,sale_id,payment_id,reason,attempt_id,lease_until,actor_user_id,request_id)
 values(org,p_id,p.provider_payment_id,btrim(p_reason),attempt,clock_timestamp()+interval '60 seconds',auth.uid(),p_request_id)
 on conflict(org_id,sale_id) do update set attempt_id=excluded.attempt_id,lease_until=excluded.lease_until,request_id=excluded.request_id;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'GATEWAY_VOID_REQUESTED',p_id,p_request_id);
 return jsonb_build_object('orgId',org,'paymentId',p.provider_payment_id,'attemptId',attempt,'amount',p.amount::text,'verified',false);
end;$$;
revoke all on function public.prepare_sale_void(uuid,text,uuid) from public,anon,service_role;
grant execute on function public.prepare_sale_void(uuid,text,uuid) to authenticated;

create function public.verify_gateway_void(p_org uuid,p_sale uuid,p_attempt uuid,p_payment text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.gateway_sale_voids;
begin
 update public.gateway_sale_voids set verified_at=coalesce(verified_at,clock_timestamp())
 where org_id=p_org and sale_id=p_sale and attempt_id=p_attempt and payment_id=p_payment returning * into v;
 if not found then raise sqlstate 'PT409' using message='VOID_ATTEMPT_CHANGED';end if;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(v.org_id,v.actor_user_id,'GATEWAY_VOID_VERIFIED',v.sale_id,v.request_id);
end;$$;
revoke all on function public.verify_gateway_void(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.verify_gateway_void(uuid,uuid,uuid,text) to service_role;

-- Retain the original atomic restock/audit transaction, gated by server-only proof.
do $block$ declare definition text;old_guard text;new_guard text;begin
 definition=pg_get_functiondef('public.void_sale(uuid,text,uuid)'::regprocedure);
 old_guard='if exists(select 1 from public.payments where sale_id=p_id and org_id=v_org and provider_payment_id is not null) then raise sqlstate ''PT409'' using message=''GATEWAY_VOID_REQUIRES_PROVIDER'';end if;';
 new_guard='if exists(select 1 from public.payments where sale_id=p_id and org_id=v_org and provider_payment_id is not null) and not exists(select 1 from public.gateway_sale_voids v join public.payments p on p.org_id=v.org_id and p.sale_id=v.sale_id and p.provider_payment_id=v.payment_id where v.org_id=v_org and v.sale_id=p_id and v.reason=btrim(p_reason) and v.verified_at is not null) then raise sqlstate ''PT409'' using message=''GATEWAY_VOID_REQUIRES_PROVIDER'';end if;';
 if position(old_guard in definition)=0 then raise exception 'Gateway void guard not found';end if;
 definition=replace(definition,old_guard,new_guard);
 -- Verified external voids may finish recovery after midnight; unverified new voids cannot start.
 definition=replace(definition,'if (v_now at time zone ''Asia/Bangkok'')::date<>','if not exists(select 1 from public.gateway_sale_voids where org_id=v_org and sale_id=p_id and reason=btrim(p_reason) and verified_at is not null) and (v_now at time zone ''Asia/Bangkok'')::date<>');
 -- The first date condition contains OR; enclose that entire original condition.
 definition=replace(definition,'and (v_now at time zone ''Asia/Bangkok'')::date<>(v_sale.completed_at at time zone ''Asia/Bangkok'')::date or v_now<v_sale.completed_at then','and ((v_now at time zone ''Asia/Bangkok'')::date<>(v_sale.completed_at at time zone ''Asia/Bangkok'')::date or v_now<v_sale.completed_at) then');
 execute definition;
end;$block$;
notify pgrst,'reload schema';

do $block$ declare definition text;begin
 definition=pg_get_functiondef('public.sale_bill_view(uuid,integer,timestamptz,timestamptz,text,date,uuid)'::regprocedure);
 definition=replace(definition,'''paymentMethod'',p.method','''gatewayPayment'',p.provider_payment_id is not null,''paymentMethod'',p.method');
 execute definition;
end;$block$;
notify pgrst,'reload schema';

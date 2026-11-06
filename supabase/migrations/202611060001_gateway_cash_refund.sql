-- Local sale cancellation: staff return cash; ReservePay payment is retained unchanged.
create table public.gateway_cash_refunds (
 org_id uuid not null references public.organizations(id),
 sale_id uuid not null,
 payment_id text not null,
 amount numeric(14,2) not null check(amount>0),
 reason text not null,
 actor_user_id uuid not null,
 request_id uuid not null,
 declared_at timestamptz not null default now(),
 primary key(org_id,sale_id),
 foreign key(org_id,sale_id) references public.sales(org_id,id)
);
alter table public.gateway_cash_refunds enable row level security;
revoke all on public.gateway_cash_refunds from public,anon,authenticated,service_role;

do $block$ declare definition text;guard text;replacement text;begin
 definition=pg_get_functiondef('public.void_sale(uuid,text,uuid)'::regprocedure);
 guard='then raise sqlstate ''PT409'' using message=''GATEWAY_VOID_REQUIRES_PROVIDER'';end if;';
 replacement='and not exists(select 1 from public.gateway_cash_refunds r join public.payments p on p.org_id=r.org_id and p.sale_id=r.sale_id and p.provider_payment_id=r.payment_id where r.org_id=v_org and r.sale_id=p_id and r.reason=btrim(p_reason) and r.amount=p.amount) '||guard;
 if position(guard in definition)=0 then raise exception 'Gateway cancellation guard not found';end if;
 execute replace(definition,guard,replacement);
end;$block$;

create function public.void_sale_cash_refund(p_id uuid,p_reason text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;s public.sales;p public.payments;inserted integer;
begin
 select m.org_id into org from public.organization_members m join public.organizations o on o.id=m.org_id where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null;
 if org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_id is null or p_request_id is null or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into s from public.sales where org_id=org and id=p_id for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 select * into p from public.payments where org_id=org and sale_id=p_id;
 if s.status='VOIDED' or p.provider_payment_id is null or exists(select 1 from public.gateway_sale_voids v where v.org_id=org and v.sale_id=p_id and v.verified_at is not null and v.reason=btrim(p_reason)) then return public.void_sale(p_id,p_reason,p_request_id);end if;
 if (clock_timestamp() at time zone 'Asia/Bangkok')::date<>(s.completed_at at time zone 'Asia/Bangkok')::date or clock_timestamp()<s.completed_at then raise sqlstate 'PT409' using message='VOID_WINDOW_EXPIRED';end if;
 insert into public.gateway_cash_refunds(org_id,sale_id,payment_id,amount,reason,actor_user_id,request_id)
 values(org,p_id,p.provider_payment_id,p.amount,btrim(p_reason),auth.uid(),p_request_id)
 on conflict(org_id,sale_id) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'GATEWAY_CASH_REFUND_DECLARED',p_id,p_request_id);end if;
 return public.void_sale(p_id,p_reason,p_request_id);
end;$$;
revoke all on function public.void_sale_cash_refund(uuid,text,uuid) from public,anon,service_role;
grant execute on function public.void_sale_cash_refund(uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';

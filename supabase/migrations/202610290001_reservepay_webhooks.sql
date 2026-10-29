-- Signed ReservePay notifications are a durable audit signal. Provider lookup remains payment authority.
create table public.reservepay_webhook_events (
 event_id text primary key,
 org_id uuid not null references public.organizations(id),
 session_hash text not null references public.reservepay_payment_sessions(session_hash),
 payment_id text not null,
 event text not null check (event in ('payment_completed','payment_expired')),
 reported_status text not null,
 provider_status text,
 delivered_at timestamptz not null,
 processed_at timestamptz,
 created_at timestamptz not null default now()
);
create index reservepay_webhook_events_org_time on public.reservepay_webhook_events(org_id,created_at desc);
alter table public.reservepay_webhook_events enable row level security;
revoke all on public.reservepay_webhook_events from public,anon,authenticated;
grant select,insert,update on public.reservepay_webhook_events to service_role;

-- Run the existing atomic gateway checkout as the original cashier after independent provider verification.
-- Only the secret server client can call this wrapper; the existing RPC still validates active membership.
create function public.complete_gateway_sale_webhook(p_hash text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cashier uuid;
begin
 select user_id into cashier from public.reservepay_payment_sessions where session_hash=p_hash;
 if cashier is null then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 perform set_config('request.jwt.claim.sub',cashier::text,true);
 return public.complete_gateway_sale(p_hash,p_request);
end;$$;
revoke all on function public.complete_gateway_sale_webhook(text,uuid) from public,anon,authenticated;
grant execute on function public.complete_gateway_sale_webhook(text,uuid) to service_role;

create or replace function private.purge_expired_logs() returns jsonb language plpgsql security definer set search_path='' as $$
declare requests integer;activities integer;
begin
 delete from private.request_logs where created_at<now()-interval '30 days';get diagnostics requests=row_count;
 delete from public.activity_logs where created_at<now()-interval '30 days';get diagnostics activities=row_count;
 delete from public.restaurant_guest_activity_logs where created_at<now()-interval '30 days';
 delete from public.reservepay_webhook_events where created_at<now()-interval '30 days';
 delete from private.restaurant_guest_limits where window_at<now()-interval '1 day';
 return jsonb_build_object('requestLogs',requests,'activityLogs',activities);
end;$$;

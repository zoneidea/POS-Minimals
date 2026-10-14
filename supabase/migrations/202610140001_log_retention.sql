-- Application diagnostics are server-only; business sales/stock records are not purged.
create table private.request_logs (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null, method text not null, route text not null,
 status integer not null check(status between 100 and 599),
 duration_ms integer not null check(duration_ms>=0),
 created_at timestamptz not null default now()
);
create index request_logs_created on private.request_logs(created_at);
create index activity_logs_retention_time on public.activity_logs(created_at);
alter table private.request_logs enable row level security;
revoke all on private.request_logs from public,anon,authenticated;
create function public.record_request_log(p_request_id uuid,p_method text,p_route text,p_status integer,p_duration integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_method not in ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS') or length(p_route)>200 or p_route!~'^[A-Za-z0-9/_:-]+$' then raise exception 'Invalid log metadata'; end if;
 insert into private.request_logs(request_id,method,route,status,duration_ms) values(p_request_id,p_method,p_route,p_status,p_duration);
end;$$;
revoke all on function public.record_request_log(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.record_request_log(uuid,text,text,integer,integer) to service_role;
create function private.purge_expired_logs() returns jsonb language plpgsql security definer set search_path='' as $$
declare requests integer;activities integer;
begin
 delete from private.request_logs where created_at<now()-interval '30 days';get diagnostics requests=row_count;
 delete from public.activity_logs where created_at<now()-interval '30 days';get diagnostics activities=row_count;
 return jsonb_build_object('requestLogs',requests,'activityLogs',activities);
end;$$;
revoke all on function private.purge_expired_logs() from public,anon,authenticated,service_role;

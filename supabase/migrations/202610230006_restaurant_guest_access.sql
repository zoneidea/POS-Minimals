create table public.restaurant_guest_access(
 id uuid primary key,org_id uuid not null references public.organizations(id),bill_id uuid not null references public.restaurant_bills(id),
 token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),expires_at timestamptz not null,revoked_at timestamptz,
 created_at timestamptz not null default now(),created_by uuid not null references auth.users
);
create unique index restaurant_guest_active_bill on public.restaurant_guest_access(org_id,bill_id) where revoked_at is null;
alter table public.restaurant_guest_access enable row level security;
revoke all on public.restaurant_guest_access from public,anon,authenticated;
create table private.restaurant_guest_limits(key text primary key,window_at timestamptz not null,hits integer not null);
create index restaurant_guest_limits_window on private.restaurant_guest_limits(window_at);
revoke all on private.restaurant_guest_limits from public,anon,authenticated;
alter table public.restaurant_rounds add column source text not null default 'STAFF' check(source in ('STAFF','GUEST'));
alter table public.restaurant_rounds add column guest_access_id uuid references public.restaurant_guest_access(id);
alter table public.restaurant_rounds alter column created_by drop not null;
alter table public.restaurant_rounds add constraint restaurant_round_source check((source='STAFF' and created_by is not null and guest_access_id is null) or (source='GUEST' and created_by is null and guest_access_id is not null));
create function public.restaurant_issue_guest_access(p_bill uuid,p_version bigint,p_id uuid,p_hash text,p_revoke boolean,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;a public.restaurant_guest_access;
begin
 org=private.restaurant_org();
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if b.status<>'OPEN' then raise sqlstate 'PT409' using message='BILL_CLOSED';end if;
 if p_request is null or p_revoke is null or p_version is null or b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 if p_revoke then
 update public.restaurant_guest_access set revoked_at=now() where org_id=org and bill_id=b.id and revoked_at is null;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_GUEST_ACCESS_REVOKED',b.id,p_request);
 return jsonb_build_object('revoked',true);
 end if;
 select * into a from public.restaurant_guest_access where org_id=org and bill_id=b.id and revoked_at is null;
 if found and a.expires_at>now() then return jsonb_build_object('id',a.id,'hash',a.token_hash,'expiresAt',a.expires_at);end if;
 if p_id is null or p_hash is null or p_hash!~'^[0-9a-f]{64}$' then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 update public.restaurant_guest_access set revoked_at=now() where org_id=org and bill_id=b.id and revoked_at is null;
 insert into public.restaurant_guest_access(id,org_id,bill_id,token_hash,expires_at,created_by) values(p_id,org,b.id,p_hash,now()+interval '24 hours',auth.uid()) returning * into a;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_GUEST_ACCESS_ISSUED',b.id,p_request);
 return jsonb_build_object('id',a.id,'hash',a.token_hash,'expiresAt',a.expires_at);
end;$$;
create table public.restaurant_guest_activity_logs(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),access_id uuid not null references public.restaurant_guest_access(id),round_id uuid not null references public.restaurant_rounds(id),request_id uuid not null,created_at timestamptz not null default now()
);
create index restaurant_guest_logs_created on public.restaurant_guest_activity_logs(created_at);
alter table public.restaurant_guest_activity_logs enable row level security;
revoke all on public.restaurant_guest_activity_logs from public,anon,authenticated;
grant select on public.restaurant_guest_activity_logs to authenticated;
create policy restaurant_guest_logs_owner on public.restaurant_guest_activity_logs for select to authenticated using(private.current_org_role(org_id)='OWNER');
-- Closing/cancelling the bill invalidates tokens immediately, in the same transaction.
create function private.restaurant_guest_close() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'OPEN' and old.status='OPEN' then update public.restaurant_guest_access set revoked_at=now() where org_id=new.org_id and bill_id=new.id and revoked_at is null;end if;return new;
end;$$;
create trigger restaurant_guest_close after update of status on public.restaurant_bills for each row execute function private.restaurant_guest_close();
-- Extend existing staff round DTO additively. All prior bill/receipt contracts stay valid.
create or replace function private.restaurant_bill_json(p_org uuid,p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'tableId',b.table_id,'tableName',b.table_name,'status',b.status,'version',b.version,'openedAt',b.opened_at,
 'rounds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'number',r.number,'createdAt',r.created_at,'items',r.items,'cancelled',r.cancelled_at is not null,'cancelReason',r.cancel_reason,'source',r.source) order by r.number) from public.restaurant_rounds r where r.org_id=b.org_id and r.bill_id=b.id),'[]'),
 'totalAmount',coalesce((select sum((i->>'lineTotal')::numeric) from public.restaurant_rounds r,lateral jsonb_array_elements(r.items) i where r.org_id=b.org_id and r.bill_id=b.id and r.cancelled_at is null),0)::numeric(14,2)::text)
 from public.restaurant_bills b where b.org_id=p_org and b.id=p_id;
$$;
create function private.restaurant_guest_order(p_org uuid,p_bill uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('billId',b.id,'tableName',b.table_name,'version',b.version,'totalAmount',coalesce((select sum((i->>'lineTotal')::numeric) from public.restaurant_rounds r,lateral jsonb_array_elements(r.items) i where r.org_id=b.org_id and r.bill_id=b.id and r.cancelled_at is null),0)::numeric(14,2)::text,
 'rounds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'number',r.number,'createdAt',r.created_at,'cancelled',r.cancelled_at is not null,'source',r.source,'items',(select jsonb_agg(jsonb_build_object('name',i->>'name','quantity',(i->>'quantity')::int,'lineTotal',i->>'lineTotal','options',i->'options','note',i->>'note')) from jsonb_array_elements(r.items) i)) order by r.number) from public.restaurant_rounds r where r.org_id=b.org_id and r.bill_id=b.id),'[]')) from public.restaurant_bills b where b.org_id=p_org and b.id=p_bill;
$$;
revoke all on function private.restaurant_guest_order(uuid,uuid),private.restaurant_guest_close() from public,anon,authenticated,service_role;
revoke all on function public.restaurant_issue_guest_access(uuid,bigint,uuid,text,boolean,uuid) from public,anon,service_role;
grant execute on function public.restaurant_issue_guest_access(uuid,bigint,uuid,text,boolean,uuid) to authenticated;

create or replace function private.purge_expired_logs() returns jsonb language plpgsql security definer set search_path='' as $$
declare requests integer;activities integer;
begin
 delete from private.request_logs where created_at<now()-interval '30 days';get diagnostics requests=row_count;
 delete from public.activity_logs where created_at<now()-interval '30 days';get diagnostics activities=row_count;
 delete from public.restaurant_guest_activity_logs where created_at<now()-interval '30 days';
 delete from private.restaurant_guest_limits where window_at<now()-interval '1 day';
 return jsonb_build_object('requestLogs',requests,'activityLogs',activities);
end;$$;

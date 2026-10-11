-- Identity/tenant slice. Auth identities are owned by Supabase, not this application.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  display_username text not null check (char_length(btrim(display_username)) between 1 and 80),
  role text not null check (role in ('OWNER', 'EMPLOYEE', 'ACCOUNTANT')),
  status text not null default 'ACTIVE' check (status in ('INVITED', 'ACTIVE', 'SUSPENDED')),
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  unique (org_id, user_id), unique (org_id, id)
);
create unique index members_one_active_org_per_user on public.organization_members(user_id)
  where status = 'ACTIVE' and deleted_at is null;
create index members_user_context on public.organization_members(user_id, status, org_id);
create table public.store_settings (
  org_id uuid primary key references public.organizations(id),
  store_name text not null,
  address text, phone text, tax_id text, promptpay_identifier text,
  receipt_footer text not null default '', logo_path text,
  vat_enabled boolean not null default false,
  vat_rate numeric(5,2) not null default 7.00 check (vat_rate >= 0 and vat_rate <= 100),
  vat_mode text not null default 'INCLUSIVE' check (vat_mode = 'INCLUSIVE'),
  auto_open_print_dialog boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  entity_id uuid not null,
  request_id uuid not null,
  created_at timestamptz not null default now()
);
create index activity_logs_org_time on public.activity_logs(org_id, created_at desc);

-- Fixed search path, no recursive membership policy, no client-selected actor.
create function private.current_org_role(p_org_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_members m
  join public.organizations o on o.id = m.org_id
  where m.org_id = p_org_id and m.user_id = (select auth.uid())
    and m.status = 'ACTIVE' and m.deleted_at is null
    and o.status = 'ACTIVE' and o.deleted_at is null;
$$;
revoke all on function private.current_org_role(uuid) from public, anon;
grant execute on function private.current_org_role(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.activity_logs enable row level security;
revoke all on public.organizations, public.organization_members, public.store_settings, public.activity_logs from anon, authenticated;
grant select on public.organizations, public.organization_members, public.store_settings, public.activity_logs to authenticated;
create policy organizations_member_read on public.organizations for select to authenticated
  using (private.current_org_role(id) is not null);
create policy members_scoped_read on public.organization_members for select to authenticated
  using (private.current_org_role(org_id) = 'OWNER' or
    (user_id = (select auth.uid()) and private.current_org_role(org_id) is not null));
create policy settings_owner_read on public.store_settings for select to authenticated
  using (deleted_at is null and private.current_org_role(org_id) = 'OWNER');
create policy activity_owner_read on public.activity_logs for select to authenticated
  using (private.current_org_role(org_id) = 'OWNER');

create function public.bootstrap_org(p_store_name text, p_display_username text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_member public.organization_members%rowtype;
begin
  if v_user is null then raise exception using errcode = 'PT401', message = 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception using errcode = 'PT403', message = 'EMAIL_NOT_VERIFIED';
  end if;
  if p_store_name is null or char_length(btrim(p_store_name)) not between 1 and 120
    or p_display_username is null or char_length(btrim(p_display_username)) not between 1 and 80
    or p_request_id is null then
    raise exception using errcode = 'PT400', message = 'VALIDATION_ERROR';
  end if;
  -- Serialize all provisioning attempts for the same auth user, across API instances.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select * into v_member from public.organization_members where user_id = v_user
    order by created_at, id limit 1;
  if found then
    if v_member.status <> 'ACTIVE' or v_member.deleted_at is not null
      or not exists (select 1 from public.organizations where id = v_member.org_id and status = 'ACTIVE' and deleted_at is null) then
      raise exception using errcode = 'PT403', message = 'FORBIDDEN';
    end if;
    if v_member.role <> 'OWNER' then
      raise exception using errcode = 'PT409', message = 'ORG_ALREADY_PROVISIONED';
    end if;
    return jsonb_build_object('orgId', v_member.org_id, 'role', 'OWNER', 'status', 'ACTIVE');
  end if;
  insert into public.organizations(name) values (btrim(p_store_name)) returning id into v_org;
  insert into public.organization_members(org_id, user_id, display_username, role)
    values (v_org, v_user, btrim(p_display_username), 'OWNER');
  insert into public.store_settings(org_id, store_name, updated_by)
    values (v_org, btrim(p_store_name), v_user);
  insert into public.activity_logs(org_id, actor_user_id, action, entity_id, request_id)
    values (v_org, v_user, 'ORG_BOOTSTRAPPED', v_org, p_request_id);
  return jsonb_build_object('orgId', v_org, 'role', 'OWNER', 'status', 'ACTIVE');
end;
$$;
revoke all on function public.bootstrap_org(text, text, uuid) from public, anon;
grant execute on function public.bootstrap_org(text, text, uuid) to authenticated;

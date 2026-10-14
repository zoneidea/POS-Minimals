-- Operational deduplication record; contains no contact data or API credentials.
create table public.reservepay_contacts (
 org_id uuid primary key references public.organizations(id),
 state text not null check(state in ('PENDING','SENT','FAILED','UNKNOWN')),
 request_id uuid not null,
 http_status integer,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.reservepay_contacts enable row level security;
revoke all on public.reservepay_contacts from public,anon,authenticated;
grant select,insert,update on public.reservepay_contacts to service_role;
notify pgrst,'reload schema';

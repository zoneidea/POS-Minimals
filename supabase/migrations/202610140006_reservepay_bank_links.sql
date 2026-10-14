create table public.reservepay_bank_links (
 org_id uuid not null references public.organizations(id),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('PENDING','SENT','FAILED','UNKNOWN')),
 request_id uuid not null,http_status integer,diagnostic jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(org_id,fingerprint),
 check(diagnostic is null or octet_length(diagnostic::text)<=10000)
);
-- Serialize primary-account changes and block automatic changes after an uncertain result.
create unique index reservepay_bank_link_inflight on public.reservepay_bank_links(org_id) where state in ('PENDING','UNKNOWN');
alter table public.reservepay_bank_links enable row level security;
revoke all on public.reservepay_bank_links from public,anon,authenticated;
grant select,insert,update on public.reservepay_bank_links to service_role;
notify pgrst,'reload schema';

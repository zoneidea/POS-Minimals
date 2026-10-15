-- Provider orchestration records, separate from paid sales. No customer PII or API keys.
create table public.reservepay_payment_sessions (
 session_hash text primary key check (length(session_hash)=64),
 org_id uuid not null references public.organizations(id),
 user_id uuid not null,
 quote_hash text not null,
 amount_minor text not null check (amount_minor ~ '^[1-9][0-9]*$'),
 created_at timestamptz not null default now()
);
alter table public.reservepay_payment_sessions enable row level security;
revoke all on public.reservepay_payment_sessions from anon,authenticated;
grant select,insert on public.reservepay_payment_sessions to service_role;
comment on table public.reservepay_payment_sessions is 'Immutable session ownership and quote binding; not evidence of payment or completed sale.';

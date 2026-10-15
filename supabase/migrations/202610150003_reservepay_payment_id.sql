-- Retain provider payment references for future void/reconciliation, not payment proof.
alter table public.reservepay_payment_sessions add column payment_id text
 check (payment_id is null or payment_id ~ '^pay_[A-Za-z0-9_-]{1,196}$');
create unique index reservepay_payment_id_unique on public.reservepay_payment_sessions(payment_id) where payment_id is not null;
grant update(payment_id) on public.reservepay_payment_sessions to service_role;
create function private.protect_reservepay_payment_id() returns trigger language plpgsql set search_path='' as $$
begin
 if old.payment_id is not null and new.payment_id is distinct from old.payment_id then
  raise exception using errcode='PT409',message='PAYMENT_REFERENCE_CONFLICT';
 end if;
 return new;
end;
$$;
revoke all on function private.protect_reservepay_payment_id() from public,anon,authenticated;
create trigger reservepay_payment_id_immutable before update of payment_id on public.reservepay_payment_sessions
for each row execute function private.protect_reservepay_payment_id();

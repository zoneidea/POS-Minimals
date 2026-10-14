alter table public.reservepay_contacts add column diagnostic jsonb;
alter table public.reservepay_contacts add constraint reservepay_diagnostic_size check(diagnostic is null or octet_length(diagnostic::text)<=10000);
notify pgrst,'reload schema';

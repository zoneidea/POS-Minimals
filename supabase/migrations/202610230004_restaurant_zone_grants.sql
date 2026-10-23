-- Supabase default table privileges must not expose direct mutations or TRUNCATE.
-- Keep zone writes exclusively in the scoped owner RPC.
revoke all on public.restaurant_zones from public,anon,authenticated;
grant select on public.restaurant_zones to authenticated;

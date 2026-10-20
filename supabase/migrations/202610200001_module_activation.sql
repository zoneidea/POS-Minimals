-- Ownership remains the org_modules row; enabled is a reversible usage preference.
create function public.set_org_module_enabled(p_module_code text,p_enabled boolean,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;current_enabled boolean;
begin
 org=private.coupon_org(array['OWNER'],false);
 if p_module_code is distinct from 'coupons' or p_enabled is null or p_request is null then
  raise sqlstate 'PT400' using message='VALIDATION_ERROR';
 end if;
 select enabled into current_enabled from public.org_modules where org_id=org and module_code=p_module_code for update;
 if not found then raise sqlstate 'PT409' using message='MODULE_NOT_PURCHASED';end if;
 if current_enabled is distinct from p_enabled then
  update public.org_modules set enabled=p_enabled where org_id=org and module_code=p_module_code;
  insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id)
  values(org,auth.uid(),case when p_enabled then 'MODULE_COUPONS_ENABLED' else 'MODULE_COUPONS_DISABLED' end,org,p_request);
 end if;
 return jsonb_build_object('coupons',p_enabled,'purchased',jsonb_build_object('coupons',true));
end;$$;
revoke all on function public.set_org_module_enabled(text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_org_module_enabled(text,boolean,uuid) to authenticated;
notify pgrst,'reload schema';

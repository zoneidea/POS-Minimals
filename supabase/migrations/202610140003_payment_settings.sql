alter table public.store_settings add column payment_cipher text, add column payment_version bigint not null default 1;
create function public.read_payment_settings() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_result jsonb;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id) is not null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 select jsonb_build_object('cipher',s.payment_cipher,'version',s.payment_version) into v_result from public.store_settings s where s.org_id=v_org and s.deleted_at is null;
 if v_result is null then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 return v_result;
end;$$;
create function public.save_payment_settings(p_cipher text,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_before public.store_settings;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and m.status='ACTIVE' and m.deleted_at is null and private.current_org_role(m.org_id)='OWNER';
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_cipher is null or char_length(p_cipher) not between 1 and 75000 or p_request is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_before from public.store_settings where org_id=v_org and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_version is null or p_version<>v_before.payment_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.store_settings set payment_cipher=p_cipher,payment_version=payment_version+1,updated_at=now(),updated_by=auth.uid() where org_id=v_org;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_org,v_org,'PAYMENT_SETTINGS_UPDATE',auth.uid(),p_request);
 return jsonb_build_object('version',v_before.payment_version+1);
end;$$;
revoke all on function public.read_payment_settings() from public,anon;
revoke all on function public.save_payment_settings(text,bigint,uuid) from public,anon;
grant execute on function public.read_payment_settings() to authenticated;
grant execute on function public.save_payment_settings(text,bigint,uuid) to authenticated;

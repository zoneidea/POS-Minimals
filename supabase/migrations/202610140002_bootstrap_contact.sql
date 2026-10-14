-- Atomic phone capture for new store creation; legacy bootstrap remains compatible.
create function public.bootstrap_org_with_contact(p_store_name text, p_display_username text, p_request_id uuid, p_private_cipher text)
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
    or p_private_cipher is null or char_length(p_private_cipher) not between 1 and 10000
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
  insert into public.store_settings(org_id, store_name, private_cipher, updated_by)
    values (v_org, btrim(p_store_name), p_private_cipher, v_user);
  insert into public.activity_logs(org_id, actor_user_id, action, entity_id, request_id)
    values (v_org, v_user, 'ORG_BOOTSTRAPPED', v_org, p_request_id);
  return jsonb_build_object('orgId', v_org, 'role', 'OWNER', 'status', 'ACTIVE');
end;
$$;
revoke all on function public.bootstrap_org_with_contact(text, text, uuid, text) from public, anon;
grant execute on function public.bootstrap_org_with_contact(text, text, uuid, text) to authenticated;

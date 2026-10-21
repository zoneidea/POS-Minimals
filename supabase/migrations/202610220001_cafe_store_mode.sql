-- Existing stores retain RETAIL; legacy bootstrap and checkout payloads remain valid.
alter table public.store_settings add column store_mode text not null default 'RETAIL' check(store_mode in ('RETAIL','CAFE'));
create function public.bootstrap_org_with_mode(p_store_name text, p_display_username text, p_request_id uuid, p_private_cipher text, p_store_mode text)
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
  if p_store_mode is null or p_store_mode not in ('RETAIL','CAFE') or p_store_name is null or char_length(btrim(p_store_name)) not between 1 and 120
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
  insert into public.store_settings(org_id, store_name, private_cipher, updated_by, store_mode)
    values (v_org, btrim(p_store_name), p_private_cipher, v_user, p_store_mode);
  insert into public.activity_logs(org_id, actor_user_id, action, entity_id, request_id)
    values (v_org, v_user, 'ORG_BOOTSTRAPPED', v_org, p_request_id);
  return jsonb_build_object('orgId', v_org, 'role', 'OWNER', 'status', 'ACTIVE');
end;
$$;
revoke all on function public.bootstrap_org_with_mode(text, text, uuid, text, text) from public, anon;
grant execute on function public.bootstrap_org_with_mode(text, text, uuid, text, text) to authenticated;

create or replace function public.save_store_settings(p_input jsonb,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_before public.store_settings;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and private.current_org_role(m.org_id)='OWNER' and m.status='ACTIVE' and m.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_request is null or p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['storeName','vatEnabled','vatRate','receiptFooter','autoOpenPrintDialog','privateCipher','storeMode'])<>'{}'::jsonb or not(p_input ?& array['storeName','vatEnabled','vatRate','receiptFooter','autoOpenPrintDialog','privateCipher'])
 or (p_input ? 'storeMode' and (p_input->>'storeMode' is null or p_input->>'storeMode' not in ('RETAIL','CAFE')))
 or char_length(btrim(coalesce(p_input->>'storeName',''))) not between 1 and 120 or jsonb_typeof(p_input->'vatEnabled')<>'boolean' or jsonb_typeof(p_input->'autoOpenPrintDialog')<>'boolean' or coalesce(p_input->>'vatRate','')!~'^(0|[1-9][0-9]{0,2})\.[0-9]{2}$' or (p_input->>'vatRate')::numeric>100 or char_length(coalesce(p_input->>'receiptFooter',''))>1000 or char_length(coalesce(p_input->>'privateCipher','')) not between 1 and 20000 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_before from public.store_settings where org_id=v_org and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_version is null or v_before.row_version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.store_settings set store_mode=coalesce(p_input->>'storeMode',store_mode),store_name=btrim(p_input->>'storeName'),vat_enabled=(p_input->>'vatEnabled')::boolean,vat_rate=(p_input->>'vatRate')::numeric,receipt_footer=p_input->>'receiptFooter',auto_open_print_dialog=(p_input->>'autoOpenPrintDialog')::boolean,private_cipher=p_input->>'privateCipher',address=null,phone=null,tax_id=null,promptpay_identifier=null,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where org_id=v_org;
 update public.organizations set name=btrim(p_input->>'storeName') where id=v_org;
 insert into public.management_audit_logs(org_id,entity_id,action,before_json,after_json,actor_user_id,request_id) select v_org,v_org,'STORE_SETTINGS_UPDATE',to_jsonb(v_before)-array['address','phone','tax_id','promptpay_identifier'],to_jsonb(s)-array['address','phone','tax_id','promptpay_identifier'],auth.uid(),p_request from public.store_settings s where s.org_id=v_org;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_org,v_org,'STORE_SETTINGS_UPDATE',auth.uid(),p_request);
 return jsonb_build_object('version',v_before.row_version+1);
end;$$;

-- Row-locked daily counters are transactional, per-shop, and never writable by clients.
create table public.cafe_daily_queues(
 org_id uuid not null references public.organizations(id), queue_date date not null,
 last_number integer not null check(last_number>0), primary key(org_id,queue_date)
);
alter table public.cafe_daily_queues enable row level security;
revoke all on public.cafe_daily_queues from public,anon,authenticated;
create function private.checkout_store_mode(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text,p_gateway boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;result jsonb;day date;n integer;sid uuid;
begin
 org=private.coupon_org(array['OWNER','EMPLOYEE'],false);
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null for share;
 result=private.checkout_coupon_sale(p_input,p_key,p_request_id,p_identity_cipher,p_gateway);
 if coalesce((result->>'replayed')::boolean,false) or mode<>'CAFE' then return result;end if;
 day=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
 insert into public.cafe_daily_queues(org_id,queue_date,last_number) values(org,day,1)
 on conflict(org_id,queue_date) do update set last_number=public.cafe_daily_queues.last_number+1 returning last_number into n;
 result=jsonb_set(result,'{receipt,cafe}',jsonb_build_object('queueNo','A'||case when n<1000 then lpad(n::text,3,'0') else n::text end,'queueDate',day));
 sid=(result->>'saleId')::uuid;
 update public.sales set result_json=result-'replayed' where id=sid and org_id=org;
 return result;
end;$$;
revoke all on function private.checkout_store_mode(jsonb,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
create or replace function public.checkout_cash_sale(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text)
returns jsonb language sql security definer set search_path='' as $$select private.checkout_store_mode(p_input,p_key,p_request_id,p_identity_cipher,false)$$;
create or replace function private.checkout_gateway_core(p_input jsonb,p_key uuid,p_request_id uuid,p_identity_cipher text)
returns jsonb language sql security definer set search_path='' as $$select private.checkout_store_mode(p_input,p_key,p_request_id,p_identity_cipher,true)$$;
revoke all on function private.checkout_gateway_core(jsonb,uuid,uuid,text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

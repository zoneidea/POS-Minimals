alter table public.store_settings add column private_cipher text,add column row_version bigint not null default 1;
alter table public.organization_members add column row_version bigint not null default 1;
create table public.management_audit_logs(id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),entity_id uuid not null,action text not null,before_json jsonb,after_json jsonb not null,actor_user_id uuid not null references auth.users(id),request_id uuid not null,created_at timestamptz not null default now());
alter table public.management_audit_logs enable row level security;
revoke all on public.management_audit_logs from public,anon,authenticated;grant select on public.management_audit_logs to authenticated;
create policy management_audit_owner on public.management_audit_logs for select to authenticated using(private.current_org_role(org_id)='OWNER');
create function public.save_store_settings(p_input jsonb,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_before public.store_settings;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and private.current_org_role(m.org_id)='OWNER' and m.status='ACTIVE' and m.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_request is null or p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['storeName','vatEnabled','vatRate','receiptFooter','autoOpenPrintDialog','privateCipher'])<>'{}'::jsonb or not(p_input ?& array['storeName','vatEnabled','vatRate','receiptFooter','autoOpenPrintDialog','privateCipher'])
 or char_length(btrim(coalesce(p_input->>'storeName',''))) not between 1 and 120 or jsonb_typeof(p_input->'vatEnabled')<>'boolean' or jsonb_typeof(p_input->'autoOpenPrintDialog')<>'boolean' or coalesce(p_input->>'vatRate','')!~'^(0|[1-9][0-9]{0,2})\.[0-9]{2}$' or (p_input->>'vatRate')::numeric>100 or char_length(coalesce(p_input->>'receiptFooter',''))>1000 or char_length(coalesce(p_input->>'privateCipher','')) not between 1 and 20000 then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into v_before from public.store_settings where org_id=v_org and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_version is null or v_before.row_version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.store_settings set store_name=btrim(p_input->>'storeName'),vat_enabled=(p_input->>'vatEnabled')::boolean,vat_rate=(p_input->>'vatRate')::numeric,receipt_footer=p_input->>'receiptFooter',auto_open_print_dialog=(p_input->>'autoOpenPrintDialog')::boolean,private_cipher=p_input->>'privateCipher',address=null,phone=null,tax_id=null,promptpay_identifier=null,row_version=row_version+1,updated_at=now(),updated_by=auth.uid() where org_id=v_org;
 update public.organizations set name=btrim(p_input->>'storeName') where id=v_org;
 insert into public.management_audit_logs(org_id,entity_id,action,before_json,after_json,actor_user_id,request_id) select v_org,v_org,'STORE_SETTINGS_UPDATE',to_jsonb(v_before)-array['address','phone','tax_id','promptpay_identifier'],to_jsonb(s)-array['address','phone','tax_id','promptpay_identifier'],auth.uid(),p_request from public.store_settings s where s.org_id=v_org;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_org,v_org,'STORE_SETTINGS_UPDATE',auth.uid(),p_request);
 return jsonb_build_object('version',v_before.row_version+1);
end;$$;
create function public.manage_staff(p_id uuid,p_role text,p_status text,p_version bigint,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_before public.organization_members;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and private.current_org_role(m.org_id)='OWNER' and m.status='ACTIVE' and m.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_request is null or p_role is null or p_role not in ('EMPLOYEE','ACCOUNTANT') or p_status is null or p_status not in ('ACTIVE','SUSPENDED','DELETED') then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 perform 1 from public.organizations where id=v_org for update;
 select * into v_before from public.organization_members where org_id=v_org and id=p_id and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if v_before.role='OWNER' then raise sqlstate 'PT409' using message='OWNER_PROTECTED';end if;
 if v_before.status='INVITED' and p_status='ACTIVE' then raise sqlstate 'PT409' using message='INVITE_NOT_ACCEPTED';end if;
 if p_version is null or p_version<>v_before.row_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 update public.organization_members set role=p_role,status=case when p_status='DELETED' then 'SUSPENDED' else p_status end,deleted_at=case when p_status='DELETED' then now() else null end,deleted_by=case when p_status='DELETED' then auth.uid() else null end,row_version=row_version+1 where id=p_id and org_id=v_org;
 insert into public.management_audit_logs(org_id,entity_id,action,before_json,after_json,actor_user_id,request_id) select v_org,p_id,'STAFF_UPDATE',to_jsonb(v_before),to_jsonb(m),auth.uid(),p_request from public.organization_members m where m.id=p_id;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_org,p_id,'STAFF_UPDATE',auth.uid(),p_request);
 return jsonb_build_object('version',v_before.row_version+1);
end;$$;
create function public.add_invited_staff(p_user uuid,p_role text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_id uuid;
begin
 select m.org_id into v_org from public.organization_members m where m.user_id=auth.uid() and private.current_org_role(m.org_id)='OWNER' and m.status='ACTIVE' and m.deleted_at is null;
 if v_org is null then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 if p_role is null or p_role not in ('EMPLOYEE','ACCOUNTANT') or p_request is null or p_user is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.organization_members where user_id=p_user) then raise sqlstate 'PT409' using message='MEMBER_EXISTS';end if;
 insert into public.organization_members(org_id,user_id,display_username,role,status) values(v_org,p_user,'สมาชิกใหม่',p_role,'INVITED') returning id into v_id;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_org,v_id,'STAFF_INVITED',auth.uid(),p_request);return v_id;
end;$$;
create function public.accept_staff_invite(p_alias text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_member public.organization_members;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise sqlstate 'PT403' using message='EMAIL_NOT_VERIFIED';end if;
 if char_length(btrim(coalesce(p_alias,''))) not between 1 and 80 or p_request is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into v_member from public.organization_members where user_id=auth.uid() and status='INVITED' and deleted_at is null for update;
 if not found then raise sqlstate 'PT404' using message='NO_INVITATION';end if;
 if not exists(select 1 from public.organizations where id=v_member.org_id and status='ACTIVE' and deleted_at is null) then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 update public.organization_members set status='ACTIVE',display_username=btrim(p_alias),row_version=row_version+1,joined_at=now() where id=v_member.id;
 insert into public.activity_logs(org_id,entity_id,action,actor_user_id,request_id) values(v_member.org_id,v_member.id,'STAFF_ACCEPTED',auth.uid(),p_request);return v_member.org_id;
end;$$;
revoke all on function public.save_store_settings(jsonb,bigint,uuid),public.manage_staff(uuid,text,text,bigint,uuid),public.add_invited_staff(uuid,text,uuid),public.accept_staff_invite(text,uuid) from public,anon;
grant execute on function public.save_store_settings(jsonb,bigint,uuid),public.manage_staff(uuid,text,text,bigint,uuid),public.add_invited_staff(uuid,text,uuid),public.accept_staff_invite(text,uuid) to authenticated;
notify pgrst,'reload schema';

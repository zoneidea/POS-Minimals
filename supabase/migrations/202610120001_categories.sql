create table public.categories (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id),
 name text not null check(char_length(btrim(name)) between 1 and 120),
 sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, deleted_by uuid references auth.users(id),
 unique(org_id,id)
);
create unique index categories_active_name on public.categories(org_id,lower(btrim(name))) where deleted_at is null;
create index categories_active_list on public.categories(org_id,sort_order,name,id) where deleted_at is null;
alter table public.categories enable row level security;
revoke all on public.categories from anon,authenticated;
grant select on public.categories to authenticated;
create policy categories_read on public.categories for select to authenticated
 using(deleted_at is null and private.current_org_role(org_id) in ('OWNER','EMPLOYEE'));

create function public.manage_category(p_operation text,p_id uuid,p_name text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_row public.categories%rowtype; v_used boolean;
begin
 select m.org_id into v_org from public.organization_members m
 join public.organizations o on o.id=m.org_id
 where m.user_id=auth.uid() and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null
 and o.status='ACTIVE' and o.deleted_at is null;
 if v_org is null then raise exception using errcode='PT403',message='FORBIDDEN'; end if;
 if p_request_id is null or p_operation not in ('create','update','delete') or p_operation is null then
 raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
 if p_operation <> 'delete' and (p_name is null or char_length(btrim(p_name)) not between 1 and 120) then
 raise exception using errcode='PT400',message='VALIDATION_ERROR'; end if;
 if p_operation='create' then
 insert into public.categories(org_id,name) values(v_org,btrim(p_name)) returning * into v_row;
 else
 select * into v_row from public.categories where id=p_id and org_id=v_org and deleted_at is null for update;
 if not found then raise exception using errcode='PT404',message='NOT_FOUND'; end if;
 if p_operation='update' then
 update public.categories set name=btrim(p_name),updated_at=now() where id=v_row.id returning * into v_row;
 else
 -- Product module is not installed yet. Check actual active references once its table exists.
 if pg_catalog.to_regclass('public.products') is not null then
 execute 'select exists(select 1 from public.products where org_id=$1 and category_id=$2 and deleted_at is null)' into v_used using v_org,v_row.id;
 if v_used then raise exception using errcode='PT409',message='CATEGORY_IN_USE'; end if;
 end if;
 update public.categories set deleted_at=now(),deleted_by=auth.uid(),updated_at=now() where id=v_row.id;
 end if;
 end if;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id)
 values(v_org,auth.uid(),'CATEGORY_'||upper(p_operation),v_row.id,p_request_id);
 return jsonb_build_object('id',v_row.id,'name',v_row.name,'sortOrder',v_row.sort_order);
exception when unique_violation then raise exception using errcode='PT409',message='CATEGORY_NAME_EXISTS';
end; $$;
revoke all on function public.manage_category(text,uuid,text,uuid) from public,anon;
grant execute on function public.manage_category(text,uuid,text,uuid) to authenticated;

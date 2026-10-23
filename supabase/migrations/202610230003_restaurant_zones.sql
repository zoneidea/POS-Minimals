-- Persist empty zones without changing table/bill contracts or historical receipt data.
create table public.restaurant_zones(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),
 name text not null check(char_length(btrim(name)) between 1 and 60),version bigint not null default 1 check(version>0),
 unique(org_id,name)
);
alter table public.restaurant_zones enable row level security;
create policy restaurant_zones_read on public.restaurant_zones for select to authenticated using(private.current_org_role(org_id)='OWNER');
grant select on public.restaurant_zones to authenticated;
revoke all on public.restaurant_zones from anon;
insert into public.restaurant_zones(org_id,name) select distinct org_id,zone from public.restaurant_tables where zone<>'';
-- Compatibility for older clients that still type zone names while saving tables.
create function private.restaurant_table_zone() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.zone<>'' then insert into public.restaurant_zones(org_id,name) values(new.org_id,new.zone) on conflict(org_id,name) do nothing;end if;return new;
end;$$;
create trigger restaurant_table_zone after insert or update of zone on public.restaurant_tables for each row execute function private.restaurant_table_zone();
create function public.restaurant_list_zones() returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org=private.restaurant_org(true);
 return coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name,'version',z.version) order by z.name) from public.restaurant_zones z where z.org_id=org),'[]');
end;$$;
create function public.restaurant_manage_zone(p_id uuid,p_name text,p_version bigint,p_delete boolean,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;z public.restaurant_zones;
begin
 org=private.restaurant_org(true);
 if p_request is null or p_delete is null or (not p_delete and (p_name is null or char_length(btrim(p_name)) not between 1 and 60)) or (p_delete and p_id is null) then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 if p_id is null then
 if (select count(*) from public.restaurant_zones where org_id=org)>=100 then raise sqlstate 'PT409' using message='ZONE_LIMIT';end if;
 insert into public.restaurant_zones(org_id,name) values(org,btrim(p_name)) returning * into z;
 else
 select * into z from public.restaurant_zones where org_id=org and id=p_id for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if p_version is null or z.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 if exists(select 1 from public.restaurant_tables t join public.restaurant_bills b on b.org_id=t.org_id and b.table_id=t.id and b.status='OPEN' where t.org_id=org and t.zone=z.name) then raise sqlstate 'PT409' using message='ZONE_IN_USE';end if;
 if p_delete then
 update public.restaurant_tables set zone='',version=version+1 where org_id=org and zone=z.name;
 delete from public.restaurant_zones where org_id=org and id=z.id;
 else
 -- Update zone first, so compatibility trigger sees the renamed zone.
 update public.restaurant_zones set name=btrim(p_name),version=version+1 where org_id=org and id=z.id;
 update public.restaurant_tables set zone=btrim(p_name),version=version+1 where org_id=org and zone=z.name;
 end if;
 end if;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),case when p_delete then 'RESTAURANT_ZONE_DELETED' else 'RESTAURANT_ZONE_SAVED' end,z.id,p_request);
 return jsonb_build_object('id',z.id);
 exception when unique_violation then raise sqlstate 'PT409' using message='ZONE_NAME_EXISTS';
end;$$;
revoke all on function private.restaurant_table_zone() from public,anon,authenticated,service_role;
revoke all on function public.restaurant_list_zones(),public.restaurant_manage_zone(uuid,text,bigint,boolean,uuid) from public,anon,service_role;
grant execute on function public.restaurant_list_zones(),public.restaurant_manage_zone(uuid,text,bigint,boolean,uuid) to authenticated;
notify pgrst,'reload schema';

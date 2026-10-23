-- Additive table transfer; retains the bill, rounds, guest access and settlement identity.
create table private.restaurant_table_moves(
 org_id uuid not null references public.organizations(id),key uuid not null,
 bill_id uuid not null references public.restaurant_bills(id),target_id uuid not null,
 input_version bigint not null,primary key(org_id,key)
);
revoke all on private.restaurant_table_moves from public,anon,authenticated,service_role;
create function public.restaurant_move_table(p_bill uuid,p_target uuid,p_version bigint,p_key uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;b public.restaurant_bills;t public.restaurant_tables;m private.restaurant_table_moves;
begin
 org=private.restaurant_org();
 if p_bill is null or p_target is null or p_version is null or p_version<1 or p_key is null or p_request is null then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select * into m from private.restaurant_table_moves where org_id=org and key=p_key;
 if found then
  if m.bill_id<>p_bill or m.target_id<>p_target or m.input_version<>p_version then raise sqlstate 'PT409' using message='IDEMPOTENCY_CONFLICT';end if;
  return private.restaurant_bill_json(org,p_bill);
 end if;
 select * into b from public.restaurant_bills where org_id=org and id=p_bill for update;
 if not found then raise sqlstate 'PT404' using message='NOT_FOUND';end if;
 if b.status<>'OPEN' then raise sqlstate 'PT409' using message='BILL_CLOSED';end if;
 if b.version<>p_version then raise sqlstate 'PT409' using message='VERSION_CONFLICT';end if;
 if b.table_id=p_target then raise sqlstate 'PT400' using message='SAME_TABLE';end if;
 select * into t from public.restaurant_tables where org_id=org and id=p_target for update;
 if not found or not t.enabled then raise sqlstate 'PT409' using message='TABLE_UNAVAILABLE';end if;
 if exists(select 1 from public.restaurant_bills where org_id=org and table_id=p_target and status='OPEN') then raise sqlstate 'PT409' using message='TABLE_IN_USE';end if;
 update public.restaurant_bills set table_id=t.id,table_name=t.name,version=version+1 where org_id=org and id=b.id;
 insert into private.restaurant_table_moves values(org,p_key,b.id,t.id,p_version);
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'RESTAURANT_TABLE_MOVED',b.id,p_request);
 insert into public.management_audit_logs(org_id,entity_id,action,before_json,after_json,actor_user_id,request_id)
 values(org,b.id,'RESTAURANT_TABLE_MOVED',jsonb_build_object('tableId',b.table_id),jsonb_build_object('tableId',t.id),auth.uid(),p_request);
 return private.restaurant_bill_json(org,b.id);
end;$$;
revoke all on function public.restaurant_move_table(uuid,uuid,bigint,uuid,uuid) from public,anon,service_role;
grant execute on function public.restaurant_move_table(uuid,uuid,bigint,uuid,uuid) to authenticated;

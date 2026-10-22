-- Additive cafe starter package. No existing shop is seeded by migration.
create function private.cafe_starter_catalog() returns jsonb language sql immutable set search_path='' as $$ select $catalog${"version": "cafe-starter-v1", "categories": ["กาแฟ", "ชา", "นมและโกโก้", "อิตาเลียนโซดา"], "products": [{"name": "อเมริกาโน่", "price": "50.00", "category": "กาแฟ", "groups": ["size", "sweet", "ice", "shot"]}, {"name": "เอสเย็น", "price": "55.00", "category": "กาแฟ", "groups": ["size", "sweet", "ice", "shot", "syrup", "cream"]}, {"name": "ลาเต้", "price": "55.00", "category": "กาแฟ", "groups": ["size", "sweet", "ice", "shot", "syrup", "cream"]}, {"name": "คาปูชิโน่", "price": "55.00", "category": "กาแฟ", "groups": ["size", "sweet", "ice", "shot", "syrup", "cream"]}, {"name": "มอคค่า", "price": "60.00", "category": "กาแฟ", "groups": ["size", "sweet", "ice", "shot", "cream"]}, {"name": "คาราเมลมัคคิอาโต้", "price": "65.00", "category": "กาแฟ", "groups": ["size", "sweet", "ice", "shot", "cream"]}, {"name": "ชาไทย", "price": "45.00", "category": "ชา", "groups": ["size", "sweet", "ice", "jelly"]}, {"name": "ชาเขียวนม", "price": "45.00", "category": "ชา", "groups": ["size", "sweet", "ice", "jelly"]}, {"name": "ชาดำเย็น", "price": "35.00", "category": "ชา", "groups": ["size", "sweet", "ice"]}, {"name": "ชามะนาว", "price": "40.00", "category": "ชา", "groups": ["size", "sweet", "ice"]}, {"name": "มัทฉะลาเต้", "price": "60.00", "category": "ชา", "groups": ["size", "sweet", "ice"]}, {"name": "นมสด", "price": "40.00", "category": "นมและโกโก้", "groups": ["size", "sweet", "ice", "syrup", "cream"]}, {"name": "นมชมพู", "price": "40.00", "category": "นมและโกโก้", "groups": ["size", "sweet", "ice"]}, {"name": "โกโก้", "price": "50.00", "category": "นมและโกโก้", "groups": ["size", "sweet", "ice", "cream"]}, {"name": "สตรอว์เบอร์รีโซดา", "price": "40.00", "category": "อิตาเลียนโซดา", "groups": ["size", "ice"]}, {"name": "บลูฮาวายโซดา", "price": "40.00", "category": "อิตาเลียนโซดา", "groups": ["size", "ice"]}, {"name": "ลิ้นจี่โซดา", "price": "40.00", "category": "อิตาเลียนโซดา", "groups": ["size", "ice"]}, {"name": "แดงมะนาวโซดา", "price": "40.00", "category": "อิตาเลียนโซดา", "groups": ["size", "ice"]}], "groups": [{"key": "size", "name": "ขนาด", "minChoices": 1, "maxChoices": 1, "options": [{"name": "ปกติ", "price": "0.00", "isDefault": true}, {"name": "ใหญ่", "price": "10.00", "isDefault": false}]}, {"key": "sweet", "name": "ความหวาน", "minChoices": 1, "maxChoices": 1, "options": [{"name": "ไม่หวาน 0%", "price": "0.00", "isDefault": false}, {"name": "หวาน 25%", "price": "0.00", "isDefault": false}, {"name": "หวาน 50%", "price": "0.00", "isDefault": false}, {"name": "หวาน 75%", "price": "0.00", "isDefault": false}, {"name": "หวานปกติ 100%", "price": "0.00", "isDefault": true}]}, {"key": "ice", "name": "น้ำแข็ง", "minChoices": 1, "maxChoices": 1, "options": [{"name": "ปกติ", "price": "0.00", "isDefault": true}, {"name": "น้อย", "price": "0.00", "isDefault": false}, {"name": "แยกน้ำแข็ง", "price": "0.00", "isDefault": false}]}, {"key": "shot", "name": "เพิ่มช็อต", "minChoices": 0, "maxChoices": 1, "options": [{"name": "เพิ่มช็อตกาแฟ", "price": "15.00", "isDefault": false}]}, {"key": "syrup", "name": "ไซรัป", "minChoices": 0, "maxChoices": 1, "options": [{"name": "คาราเมล", "price": "10.00", "isDefault": false}, {"name": "วานิลลา", "price": "10.00", "isDefault": false}]}, {"key": "cream", "name": "วิปครีม", "minChoices": 0, "maxChoices": 1, "options": [{"name": "เพิ่มวิปครีม", "price": "10.00", "isDefault": false}]}, {"key": "jelly", "name": "เยลลี่", "minChoices": 0, "maxChoices": 1, "options": [{"name": "เพิ่มเยลลี่", "price": "10.00", "isDefault": false}]}]}$catalog$::jsonb; $$;
revoke all on function private.cafe_starter_catalog() from public,anon,authenticated,service_role;
create table public.cafe_starter_runs(
 org_id uuid primary key references public.organizations(id), package_version text not null check(package_version='cafe-starter-v1'),
 status text not null check(status in ('APPLIED','SKIPPED','CLEARED')), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 actor_user_id uuid not null references auth.users(id),result jsonb not null default '{}'
);
create table public.cafe_starter_entries(
 org_id uuid not null references public.cafe_starter_runs(org_id),kind text not null check(kind in ('PRODUCT','CATEGORY','GROUP')),
 entity_id uuid not null,customized boolean not null default false,primary key(org_id,kind,entity_id)
);
alter table public.cafe_starter_runs enable row level security;
alter table public.cafe_starter_entries enable row level security;
revoke all on public.cafe_starter_runs,public.cafe_starter_entries from public,anon,authenticated,service_role;
-- Provenance is private to owner RPCs. Ordinary clients cannot change its flags.
create function private.cafe_starter_customized() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;org uuid;eid uuid;k text;
begin
 r=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;org=(r->>'org_id')::uuid;
 if not exists(select 1 from public.cafe_starter_runs where org_id=org and status='APPLIED') then return null;end if;
 if TG_OP='UPDATE' then
 if TG_TABLE_NAME='products' and (to_jsonb(new)-array['row_version','quantity_on_hand','updated_at','updated_by'])=(to_jsonb(old)-array['row_version','quantity_on_hand','updated_at','updated_by']) then return null;end if;
 if TG_TABLE_NAME='cafe_option_groups' and (to_jsonb(new)-'row_version')=(to_jsonb(old)-'row_version') then return null;end if;
 if TG_TABLE_NAME='cafe_options' and to_jsonb(new)=to_jsonb(old) then return null;end if;
 end if;
 if TG_TABLE_NAME='cafe_product_groups' then
 update public.cafe_starter_entries set customized=true where org_id=org and ((kind='PRODUCT' and entity_id=(r->>'product_id')::uuid) or (kind='GROUP' and entity_id=(r->>'group_id')::uuid));
 else
 k=case TG_TABLE_NAME when 'products' then 'PRODUCT' when 'categories' then 'CATEGORY' else 'GROUP' end;
 eid=case when TG_TABLE_NAME='cafe_options' then (r->>'group_id')::uuid else (r->>'id')::uuid end;
 update public.cafe_starter_entries set customized=true where org_id=org and kind=k and entity_id=eid;
 end if;
 return null;
end;$$;
revoke all on function private.cafe_starter_customized() from public,anon,authenticated,service_role;
create trigger cafe_starter_product_edit after update on public.products for each row execute function private.cafe_starter_customized();
create trigger cafe_starter_category_edit after update on public.categories for each row execute function private.cafe_starter_customized();
create trigger cafe_starter_group_edit after update on public.cafe_option_groups for each row execute function private.cafe_starter_customized();
create trigger cafe_starter_option_edit after insert or update or delete on public.cafe_options for each row execute function private.cafe_starter_customized();
create trigger cafe_starter_assignment_edit after insert or delete on public.cafe_product_groups for each row execute function private.cafe_starter_customized();

create function public.cafe_starter_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;state text;remaining int;
begin
 org=private.coupon_org(array['OWNER'],false);
 select status into state from public.cafe_starter_runs where org_id=org;
 select count(*) into remaining from public.cafe_starter_entries e where e.org_id=org and
 ((kind='PRODUCT' and exists(select 1 from public.products p where p.org_id=org and p.id=e.entity_id and p.deleted_at is null)) or
 (kind='CATEGORY' and exists(select 1 from public.categories c where c.org_id=org and c.id=e.entity_id and c.deleted_at is null)) or
 (kind='GROUP' and exists(select 1 from public.cafe_option_groups g where g.org_id=org and g.id=e.entity_id and g.deleted_at is null)));
 return jsonb_build_object('status',coalesce(state,'AVAILABLE'),'remaining',remaining,'catalog',private.cafe_starter_catalog());
end;$$;

create function public.manage_cafe_starter(p_action text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;mode text;state text;catalog jsonb;cat text;x jsonb;o jsonb;pid uuid;cid uuid;gid uuid;
 categories jsonb='{}';groupmap jsonb='{}';productmap jsonb='{}';pids uuid[]='{}';gids uuid[]='{}';cids uuid[]='{}';
 product_row public.products;made int=0;skipped int=0;removed int=0;kept int=0;v_result jsonb;pos int;
begin
 org=private.coupon_org(array['OWNER'],false);
 if p_request is null or p_action is null or p_action not in ('APPLY','SKIP','CLEAR') then raise sqlstate 'PT400' using message='VALIDATION_ERROR';end if;
 select store_mode into mode from public.store_settings where org_id=org and deleted_at is null for share;
 if p_action<>'CLEAR' and mode is distinct from 'CAFE' then raise sqlstate 'PT409' using message='CAFE_MODE_REQUIRED';end if;
 -- Match existing product -> cafe configuration lock order; serialize package decisions per shop.
 perform 1 from public.products where org_id=org and deleted_at is null order by id for update;
 perform 1 from public.categories where org_id=org and deleted_at is null order by id for update;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':cafe-config',0));
 select status into state from public.cafe_starter_runs where org_id=org for update;
 if p_action='CLEAR' then
 if state is distinct from 'APPLIED' then return jsonb_build_object('status',coalesce(state,'AVAILABLE'),'removed',0,'kept',0);end if;
 -- Freeze candidate products first; customized rows and any real stock remain owned by the shop.
 select coalesce(array_agg(p.id),'{}') into pids from public.products p join public.cafe_starter_entries e on e.org_id=p.org_id and e.entity_id=p.id and e.kind='PRODUCT' where p.org_id=org and p.deleted_at is null and not e.customized and p.quantity_on_hand=0;
 select count(*) into kept from public.cafe_starter_entries e where e.org_id=org and e.kind='PRODUCT' and exists(select 1 from public.products p where p.org_id=org and p.id=e.entity_id and p.deleted_at is null and not(p.id=any(pids)));
 update public.cafe_starter_runs set status='CLEARED',updated_at=now() where org_id=org;
 for product_row in select * from public.products where org_id=org and id=any(pids) loop
 update public.products set deleted_at=now(),deleted_by=auth.uid(),updated_at=now(),updated_by=auth.uid(),row_version=row_version+1 where id=product_row.id;
 insert into public.product_audit_logs(org_id,product_id,action,before_json,after_json,before_version,after_version,actor_user_id,request_id,reason)
 select org,product_row.id,'DELETE',private.product_json(product_row),private.product_json(n),product_row.row_version,n.row_version,auth.uid(),p_request,'CAFE_STARTER_CLEAR' from public.products n where n.id=product_row.id;
 end loop;
 -- Preserve all shared or customized categories and groups. Historical rows are never physically deleted.
 select coalesce(array_agg(g.id),'{}') into gids from public.cafe_option_groups g join public.cafe_starter_entries e on e.org_id=g.org_id and e.entity_id=g.id and e.kind='GROUP'
 where g.org_id=org and g.deleted_at is null and not e.customized and not exists(select 1 from public.cafe_product_groups a join public.products p on p.org_id=a.org_id and p.id=a.product_id where a.org_id=org and a.group_id=g.id and p.deleted_at is null);
 update public.cafe_option_groups set deleted_at=now(),enabled=false,row_version=row_version+1 where org_id=org and id=any(gids);
 update public.cafe_options set deleted_at=now(),enabled=false where org_id=org and group_id=any(gids) and deleted_at is null;
 select coalesce(array_agg(c.id),'{}') into cids from public.categories c join public.cafe_starter_entries e on e.org_id=c.org_id and e.entity_id=c.id and e.kind='CATEGORY'
 where c.org_id=org and c.deleted_at is null and not e.customized and not exists(select 1 from public.products p where p.org_id=org and p.category_id=c.id and p.deleted_at is null);
 update public.categories set deleted_at=now(),deleted_by=auth.uid(),updated_at=now() where org_id=org and id=any(cids);
 removed=cardinality(pids);v_result=jsonb_build_object('status','CLEARED','removed',removed,'kept',kept,'groupsRemoved',cardinality(gids),'categoriesRemoved',cardinality(cids));
 update public.cafe_starter_runs set result=v_result where org_id=org;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_STARTER_CLEARED',org,p_request);
 return v_result;
 end if;
 if state is not null then return jsonb_build_object('status',state,'created',0,'skipped',0);end if;
 insert into public.cafe_starter_runs(org_id,package_version,status,actor_user_id) values(org,'cafe-starter-v1',case when p_action='SKIP' then 'SKIPPED' else 'APPLIED' end,auth.uid());
 if p_action='SKIP' then
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_STARTER_SKIPPED',org,p_request);
 return jsonb_build_object('status','SKIPPED','created',0,'skipped',0);end if;
 catalog=private.cafe_starter_catalog();
 for cat in select value from jsonb_array_elements_text(catalog->'categories') loop
 select id into cid from public.categories where org_id=org and deleted_at is null and lower(btrim(name))=lower(cat) for share;
 if cid is null then
 insert into public.categories(org_id,name) values(org,cat) returning id into cid;
 cids=array_append(cids,cid);
 end if;
 categories=categories||jsonb_build_object(cat,cid);
 end loop;
 if (select count(*) from public.cafe_option_groups where org_id=org and deleted_at is null)+jsonb_array_length(catalog->'groups')>200 then raise sqlstate 'PT409' using message='OPTION_GROUP_LIMIT';end if;
 for x in select value from jsonb_array_elements(catalog->'groups') loop
 insert into public.cafe_option_groups(org_id,name,min_choices,max_choices) values(org,x->>'name',(x->>'minChoices')::int,(x->>'maxChoices')::int) returning id into gid;
 gids=array_append(gids,gid);groupmap=groupmap||jsonb_build_object(x->>'key',gid);pos=0;
 for o in select value from jsonb_array_elements(x->'options') loop
 pos=pos+1;insert into public.cafe_options(id,org_id,group_id,name,price,enabled,is_default,position) values(gen_random_uuid(),org,gid,o->>'name',(o->>'price')::numeric,true,(o->>'isDefault')::boolean,pos);
 end loop;
 end loop;
 for x in select value from jsonb_array_elements(catalog->'products') loop
 if exists(select 1 from public.products where org_id=org and deleted_at is null and lower(btrim(name))=lower(x->>'name')) then skipped=skipped+1;continue;end if;
 pid=gen_random_uuid();cid=(categories->>(x->>'category'))::uuid;
 insert into public.products(id,org_id,category_id,barcode,name,sale_price,unit_cost,quantity_on_hand,track_stock,created_by,updated_by)
 values(pid,org,cid,'CAF-'||pid::text,x->>'name',(x->>'price')::numeric,0,0,false,auth.uid(),auth.uid());
 pids=array_append(pids,pid);made=made+1;
 insert into public.cafe_product_groups(org_id,product_id,group_id) select org,pid,(groupmap->>value)::uuid from jsonb_array_elements_text(x->'groups');
 insert into public.product_audit_logs(org_id,product_id,action,after_json,after_version,actor_user_id,request_id,reason)
 select org,pid,'CREATE',private.product_json(p),p.row_version,auth.uid(),p_request,'CAFE_STARTER_APPLY' from public.products p where p.id=pid;
 end loop;
 -- Register provenance only after all package writes so import itself is never a customization.
 insert into public.cafe_starter_entries(org_id,kind,entity_id) select org,'PRODUCT',unnest(pids) union all select org,'CATEGORY',unnest(cids) union all select org,'GROUP',unnest(gids);
 v_result=jsonb_build_object('status','APPLIED','created',made,'skipped',skipped,'categoriesCreated',cardinality(cids),'groupsCreated',cardinality(gids));
 update public.cafe_starter_runs set result=v_result where org_id=org;
 insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id) values(org,auth.uid(),'CAFE_STARTER_APPLIED',org,p_request);
 return v_result;
end;$$;
revoke all on function public.cafe_starter_status(),public.manage_cafe_starter(text,uuid) from public,anon,service_role;
grant execute on function public.cafe_starter_status(),public.manage_cafe_starter(text,uuid) to authenticated;
notify pgrst,'reload schema';

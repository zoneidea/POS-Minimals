import {it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';import {readFileSync,readdirSync} from 'node:fs';
import request from 'supertest';import {createApp} from '../apps/api/src/app';
const id=(n:number)=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
it('saves cafe products, opening stock and group assignments atomically with tenant, role and stale-choice protection',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner=id(1),other=id(2),staff=id(3),retail=id(4),req=id(5);
 const as=async(uid:string,sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r.rows[0]?.result;}catch(e){await db.exec('rollback');throw e;}};
 const rpc=(uid:string,sql:string,args:unknown[]=[])=>as(uid,sql+' as result',args);
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 for(const uid of [owner,other,staff,retail])await db.query('insert into auth.users values($1,now())',[uid]);
 const org=(await rpc(owner,"select bootstrap_org_with_mode('Cafe','Owner',$1,'cipher','CAFE')",[req])).orgId;await rpc(other,"select bootstrap_org_with_mode('Other','Owner',$1,'cipher','CAFE')",[req]);await rpc(retail,"select bootstrap_org_with_mode('Retail','Owner',$1,'cipher','RETAIL')",[req]);await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,staff]);
 const groupInput={name:'Size',minChoices:1,maxChoices:1,enabled:true,productIds:[],options:[{id:id(8),name:'Large',price:'20.00',enabled:true,isDefault:true}]};
 const group=await rpc(owner,'select save_cafe_option_group(null,$1,null,$2)',[groupInput,req]);
 const save=(uid:string,barcode:string,groups:string[],versions:unknown[],product?:any)=>rpc(uid,'select manage_cafe_product($1,$2,$3,$4,null,45,10,$5,$6,$7,$8,$9)',[product?'update':'create',product?.id??null,barcode,barcode,product?.version??null,req,product?0:8,groups,versions]);
 const versions=[{id:group.id,version:1}];
 await expect(save(staff,'STAFF',[group.id],versions)).rejects.toMatchObject({code:'PT403'});await expect(save(other,'FOREIGN',[group.id],versions)).rejects.toMatchObject({code:'PT400'});await expect(save(retail,'RETAIL',[group.id],versions)).rejects.toMatchObject({code:'PT409'});
 await expect(save(owner,'BAD',[id(99)],versions)).rejects.toMatchObject({code:'PT400'});expect((await db.query<any>("select count(*)::int n from products where barcode='BAD'")).rows[0].n).toBe(0);
 const p=await save(owner,'CF-1',[group.id],versions);expect(p.quantity).toBe(8);expect((await rpc(owner,'select cafe_option_configuration(true)')).groups[0]).toMatchObject({version:2,productIds:[p.id]});
 const quote=await rpc(staff,'select quote_coupon_sale($1,$2,null)',[[{productId:p.id,quantity:1,lineId:id(20),optionIds:[id(8)]}],'0.00']);expect(quote.totalAmount).toBe('65.00');
 await expect(save(owner,'STALE',[group.id],versions)).rejects.toMatchObject({code:'PT409',message:'CAFE_OPTIONS_CHANGED'});expect((await db.query<any>("select count(*)::int n from products where barcode='STALE'")).rows[0].n).toBe(0);
 // Unchanged links need not overwrite group metadata, even if the form's group version is old.
 const same=await save(owner,'CF-EDIT',[group.id],versions,p);expect(same.quantity).toBe(8);expect((await rpc(owner,'select cafe_option_configuration(true)')).groups[0].version).toBe(2);
 await expect(save(owner,'CF-BAD-EDIT',[],versions,same)).rejects.toMatchObject({code:'PT409'});expect((await db.query<any>('select barcode from products where id=$1',[p.id])).rows[0].barcode).toBe('CF-EDIT');
 const removed=await save(owner,'CF-REMOVED',[],[{id:group.id,version:2}],same);expect(removed.quantity).toBe(8);expect((await rpc(owner,'select cafe_option_configuration(true)')).groups[0]).toMatchObject({version:3,productIds:[]});
 await db.exec("create function public.fail_cafe_assignment_audit() returns trigger language plpgsql as $$begin if new.action='CAFE_PRODUCT_OPTIONS_SAVED' then raise exception 'test audit failure';end if;return new;end;$$;create trigger fail_cafe_assignment before insert on public.activity_logs for each row execute function public.fail_cafe_assignment_audit();");
 await expect(save(owner,'ROLLBACK',[group.id],[{id:group.id,version:3}])).rejects.toThrow('test audit failure');expect((await db.query<any>("select count(*)::int n from products where barcode='ROLLBACK'")).rows[0].n).toBe(0);expect((await rpc(owner,'select cafe_option_configuration(true)')).groups[0].version).toBe(3);
 await db.exec('drop trigger fail_cafe_assignment on public.activity_logs');
 await db.query("insert into products(org_id,barcode,name,sale_price,unit_cost,created_by,updated_by) select $1,'CAP-'||n,'Capacity '||n,1,0,$2,$2 from generate_series(1,200) n",[org,owner]);await db.query("insert into cafe_product_groups(org_id,product_id,group_id) select org_id,id,$2 from products where org_id=$1 and barcode like 'CAP-%'",[org,group.id]);
 await expect(save(owner,'OVERFLOW',[group.id],[{id:group.id,version:3}])).rejects.toMatchObject({code:'PT409',message:'OPTION_GROUP_PRODUCT_LIMIT'});expect((await db.query<any>("select count(*)::int n from products where barcode='OVERFLOW'")).rows[0].n).toBe(0);
 await db.exec('set role anon');await expect(db.query('select manage_cafe_product(null,null,null,null,null,null,null,null,null,null,null,null)')).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);
it('accepts additive cafe assignments through existing product routes while preserving legacy payloads and role checks',async()=>{
 let role='OWNER';const service={list:vi.fn(),mutate:vi.fn(async(..._args:unknown[])=>({id:id(1),barcode:'CF-1',name:'Latte',categoryId:null,salePrice:'45.00',unitCost:'0.00',quantity:8,version:1,imagePath:null}))};const app=createApp({products:service,allowedOrigins:[],log:()=>{},resolveIdentity:async()=>({orgId:id(1),userId:id(2),orgName:'Shop',username:'Owner',role:role as any,permissions:[]})});
 const base={barcode:'CF-1',name:'Latte',categoryId:null,salePrice:'45.00',unitCost:'0.00',initialQuantity:8};const cafeOptions={groupIds:[id(3)],versions:[{id:id(3),version:1}]};const post=(body:object)=>request(app).post('/api/v1/inventory/products').set('Authorization','Bearer jwt').send(body);
 expect((await post(base)).status).toBe(200);expect(service.mutate.mock.calls[0]?.[3]).toEqual(base);expect((await post({...base,cafeOptions})).status).toBe(200);expect(service.mutate.mock.calls[1]?.[3]).toEqual({...base,cafeOptions});
 for(const options of [{...cafeOptions,groupIds:[id(3),id(3)]},{...cafeOptions,versions:[{id:id(3),version:0}]},{...cafeOptions,orgId:id(9)}])expect((await post({...base,cafeOptions:options})).status).toBe(400);
 role='EMPLOYEE';expect((await post({...base,cafeOptions})).status).toBe(403);expect((await request(app).post('/api/v1/inventory/products').send(base)).status).toBe(401);
});

import {it,expect,beforeAll,afterAll} from 'vitest';
import {PGlite} from '@electric-sql/pglite';import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
const db=new PGlite({extensions:{pg_trgm}});
// Full migration/WASM startup is fixture setup, not the operation under test.
beforeAll(async()=>{await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const n of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'));},30000);
afterAll(async()=>{await db.close();});
it('seeds once, isolates owners, preserves customized/shared data and clears only package data',async()=>{
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003',req='10000000-0000-4000-8000-000000000001';
 const rpc=async(uid:string,sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await db.query<any>(sql+' as result',args);await db.exec('commit');return r.rows[0]?.result;}catch(e){await db.exec('rollback');throw e;}};
 for(const u of [owner,other,staff])await db.query('insert into auth.users values($1,now())',[u]);
 const org=(await rpc(owner,"select bootstrap_org_with_mode('Cafe','Owner',$1,'cipher','CAFE')",[req])).orgId;
 const foreign=(await rpc(other,"select bootstrap_org_with_mode('Other','Owner',$1,'cipher','RETAIL')",[req])).orgId;
 await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,staff]);
 expect((await rpc(owner,'select cafe_starter_status()')).status).toBe('AVAILABLE');
 await expect(rpc(staff,'select manage_cafe_starter($1,$2)',['APPLY',req])).rejects.toMatchObject({code:'PT403'});
 await expect(rpc(other,'select manage_cafe_starter($1,$2)',['APPLY',req])).rejects.toMatchObject({message:'CAFE_MODE_REQUIRED'});
 const apply=await rpc(owner,'select manage_cafe_starter($1,$2)',['APPLY',req]);expect(apply).toMatchObject({created:18,categoriesCreated:4,groupsCreated:7,status:'APPLIED'});
 expect((await rpc(owner,'select manage_cafe_starter($1,$2)',['APPLY',req])).created).toBe(0);
 expect((await db.query('select * from products where org_id=$1',[foreign])).rows).toHaveLength(0);
 const status=await rpc(owner,'select cafe_starter_status()');expect(status.remaining).toBe(29);expect(status.catalog.products).toHaveLength(18);
 const rows=(await db.query<any>('select * from products where org_id=$1 order by name',[org])).rows;
 expect(rows.every(p=>p.track_stock===false&&Number(p.unit_cost)===0&&p.image_path===null)).toBe(true);
 const defaults=(await db.query<any>('select o.id from cafe_options o join cafe_product_groups a on a.org_id=o.org_id and a.group_id=o.group_id where a.product_id=$1 and o.is_default and o.deleted_at is null',[rows[1].id])).rows.map(r=>r.id);
 const quoted=await rpc(staff,'select quote_coupon_sale($1,$2,null)',[[{productId:rows[1].id,quantity:1,optionIds:defaults}],'0.00']);
 const checkoutInput={items:quoted.items.map((i:any)=>({productId:i.productId,lineId:i.lineId,optionIds:i.optionIds,note:i.note,quantity:i.quantity,expectedUnitPrice:i.unitPrice,expectedVersion:i.expectedVersion,expectedOptionsFingerprint:i.optionsFingerprint})),discountAmount:'0.00',expectedTotalAmount:quoted.totalAmount,payment:{method:'CASH',receivedAmount:'1000.00'}};
 const sale=await rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[checkoutInput,'20000000-0000-4000-8000-000000000001',req,'cipher']);
 expect(sale.receipt.items[0].productName).toBe(rows[1].name);
 await expect(rpc(owner,'select count(*) from cafe_starter_entries')).rejects.toMatchObject({code:'42501'});
 // Real owner edits mark provenance even after reverting the visible price.
 await rpc(owner,'select manage_product($1,$2,$3,$4,$5,$6,$7,$8,$9)',['update',rows[0].id,rows[0].barcode,rows[0].name,rows[0].category_id,'99.00','0.00',1,req]);
 const custom=await rpc(owner,"select manage_product('create',null,'OWN','My own drink',$1,70,20,null,$2)",[rows[0].category_id,req]);
 // Product reuse protects its shared group during clear.
 await db.query('insert into cafe_product_groups(org_id,product_id,group_id) select $1,$2,group_id from cafe_product_groups where product_id=$3 limit 1',[org,custom.id,rows[0].id]);
 // Sales-style row_version/quantity updates alone are not configuration edits.
 await db.query('update products set row_version=row_version+1 where id=$1',[rows[1].id]);
 const clear=await rpc(owner,'select manage_cafe_starter($1,$2)',['CLEAR',req]);expect(clear.removed).toBe(17);expect(clear.kept).toBe(1);
 expect((await db.query('select * from products where org_id=$1 and deleted_at is null',[org])).rows).toHaveLength(2);
 expect((await db.query('select * from products where org_id=$1',[org])).rows).toHaveLength(19);
 const historical=(await db.query<any>('select result_json from sales where id=$1',[sale.saleId])).rows[0].result_json;expect(historical.receipt).toEqual(sale.receipt);
 expect((await rpc(owner,'select manage_cafe_starter($1,$2)',['CLEAR',req])).removed).toBe(0);
 expect((await rpc(owner,'select manage_cafe_starter($1,$2)',['APPLY',req])).created).toBe(0);
 expect((await db.query("select * from product_audit_logs where org_id=$1 and reason='CAFE_STARTER_CLEAR'",[org])).rows).toHaveLength(17);
 const existingOwner='00000000-0000-4000-8000-000000000004';await db.query('insert into auth.users values($1,now())',[existingOwner]);
 const existingOrg=(await rpc(existingOwner,"select bootstrap_org_with_mode('Existing','Owner',$1,'cipher','CAFE')",[req])).orgId;
 const ownCategory=await rpc(existingOwner,"select manage_category('create',null,'กาแฟ',$1)",[req]);
 await rpc(existingOwner,"select manage_product('create',null,'EXISTING','อเมริกาโน่',$1,99,12,null,$2)",[ownCategory.id,req]);
 expect(await rpc(existingOwner,'select manage_cafe_starter($1,$2)',['APPLY',req])).toMatchObject({created:17,skipped:1,categoriesCreated:3});
 await rpc(existingOwner,'select manage_cafe_starter($1,$2)',['CLEAR',req]);
 expect((await db.query<any>('select sale_price from products where org_id=$1 and deleted_at is null',[existingOrg])).rows).toEqual([{sale_price:'99.00'}]);
 expect((await db.query('select * from categories where org_id=$1 and deleted_at is null',[existingOrg])).rows).toHaveLength(1);
 await db.query("update store_settings set store_mode='CAFE' where org_id=$1",[foreign]);
 await db.exec("create function public.fail_starter_test() returns trigger language plpgsql as $$ begin if new.name='ลาเต้' then raise exception 'fixture rollback';end if;return new;end;$$;create trigger fail_starter before insert on products for each row execute function fail_starter_test();");
 await expect(rpc(other,'select manage_cafe_starter($1,$2)',['APPLY',req])).rejects.toMatchObject({message:'fixture rollback'});
 for(const table of ['products','categories','cafe_option_groups','cafe_starter_runs','cafe_starter_entries'])expect((await db.query('select * from '+table+' where org_id=$1',[foreign])).rows).toHaveLength(0);
 await db.exec('drop trigger fail_starter on products;drop function fail_starter_test();');
 expect((await rpc(other,'select manage_cafe_starter($1,$2)',['SKIP',req])).status).toBe('SKIPPED');expect((await rpc(other,'select manage_cafe_starter($1,$2)',['APPLY',req])).created).toBe(0);
},10000);

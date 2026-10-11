import { beforeAll,afterAll,it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync,readdirSync } from 'node:fs';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',employee='00000000-0000-4000-8000-000000000003',accountant='00000000-0000-4000-8000-000000000004';
const requestId='10000000-0000-4000-8000-000000000001';
let db:PGlite,orgA:string,orgB:string,category:string,product:string;
async function as<T>(uid:string,fn:()=>Promise<T>,anonymous=false){await db.exec('begin');try{await db.exec(anonymous?'set local role anon':'set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);const value=await fn();await db.exec('commit');return value;}catch(error){await db.exec('rollback');throw error;}}
async function mutate(operation:string,id:string|null=null,barcode='00123',cat:string|null=category,expected:number|null=null,price='12.00'){
 const result=await db.query<{result:{id:string;barcode:string;quantity:number;version:number;salePrice:string}}> ('select public.manage_product($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',[operation,id,barcode,'Coffee',cat,price,'5.00',expected,requestId]);return result.rows[0]!.result;
}
beforeAll(async()=>{
 db=new PGlite();await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));
 for(const name of readdirSync('supabase/migrations').sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
 for(const id of [owner,other,employee,accountant])await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[id]);
 const bootstrap=async()=>{const r=await db.query<{result:{orgId:string}}>('select public.bootstrap_org($1,$2,$3) as result',['Store','Owner',requestId]);return r.rows[0]!.result.orgId;};
 orgA=await as(owner,bootstrap);orgB=await as(other,bootstrap);
 for(const [id,role] of [[employee,'EMPLOYEE'],[accountant,'ACCOUNTANT']])await db.query('insert into public.organization_members(org_id,user_id,display_username,role) values($1,$2,$3,$4)',[orgA,id,'User',role]);
 const r=await as(owner,()=>db.query<{result:{id:string}}>("select public.manage_category('create',null,'Drinks',$1) as result",[requestId]));category=r.rows[0]!.result.id;
},30000);
afterAll(async()=>{await db?.close();});
it('creates zero stock with exact money and before/after audit',async()=>{const row=await as(owner,()=>mutate('create'));product=row.id;expect(row).toMatchObject({barcode:'00123',quantity:0,version:1,salePrice:'12.00'});const audit=await db.query<{before_json:unknown;after_json:{barcode:string}}>('select before_json,after_json from public.product_audit_logs where product_id=$1',[product]);expect(audit.rows[0]).toMatchObject({before_json:null,after_json:{barcode:'00123'}});});
it('prevents duplicate barcode in same org but permits another org',async()=>{await expect(as(owner,()=>mutate('create'))).rejects.toMatchObject({code:'PT409'});await as(other,()=>mutate('create',null,'00123',null));});
it('hides other-store inventory and cost from employee/accountant',async()=>{expect((await as(owner,()=>db.query('select id from public.products'))).rows).toEqual([{id:product}]);for(const uid of [employee,accountant]){expect((await as(uid,()=>db.query('select * from public.products'))).rows).toEqual([]);expect((await as(uid,()=>db.query('select * from public.product_audit_logs'))).rows).toEqual([]);await expect(as(uid,()=>mutate('delete',product,'00123',category,1))).rejects.toMatchObject({code:'PT403'});}});
it('rejects guessed cross-tenant IDs and categories',async()=>{await expect(as(other,()=>mutate('update',product,'00123',null,1))).rejects.toMatchObject({code:'PT404'});await expect(as(other,()=>mutate('create',null,'OTHER',category))).rejects.toMatchObject({code:'PT400'});});
it('locks category attachment against category soft-delete',async()=>{await expect(as(owner,()=>db.query("select public.manage_category('delete',$1,null,$2)",[category,requestId]))).rejects.toMatchObject({code:'PT409'});});
it('edits metadata only, bumps version and rejects stale writes without extra audit',async()=>{expect((await as(owner,()=>mutate('update',product,'00123',category,1,'13.50'))).version).toBe(2);await expect(as(owner,()=>mutate('update',product,'00123',category,1))).rejects.toMatchObject({code:'PT409'});expect((await db.query('select id from public.product_audit_logs where product_id=$1',[product])).rows).toHaveLength(2);});
it('soft deletes with retained barcode and versioned history',async()=>{await as(owner,()=>mutate('delete',product,'00123',category,2));expect((await as(owner,()=>db.query('select id from public.products where id=$1',[product]))).rows).toEqual([]);expect((await db.query('select deleted_by,row_version from public.products where id=$1',[product])).rows[0]).toMatchObject({deleted_by:owner,row_version:3});await expect(as(owner,()=>mutate('create'))).rejects.toMatchObject({code:'PT409'});expect((await db.query('select id from public.product_audit_logs where product_id=$1',[product])).rows).toHaveLength(3);});
it('cannot attach to a deleted category',async()=>{await as(owner,()=>db.query("select public.manage_category('delete',$1,null,$2)",[category,requestId]));await expect(as(owner,()=>mutate('create',null,'NEW'))).rejects.toMatchObject({code:'PT400'});});
it('denies direct writes and anonymous RPC even with guessed owner ID',async()=>{await expect(as(owner,()=>db.query('delete from public.products'))).rejects.toMatchObject({code:'42501'});await expect(as(owner,()=>db.query('delete from public.product_audit_logs'))).rejects.toMatchObject({code:'42501'});await expect(as(owner,()=>mutate('create',null,'ANON',null),true)).rejects.toMatchObject({code:'42501'});});
it('RPC rejects negative and excessive-precision amounts',async()=>{for(const price of ['-1','1.234'])await expect(as(owner,()=>mutate('create',null,'BAD',null,null,price))).rejects.toMatchObject({code:'PT400'});});
it('audit failure rolls back product changes',async()=>{await db.exec("alter table public.product_audit_logs add constraint test_audit_failure check (action<>'CREATE') not valid");try{await expect(as(owner,()=>mutate('create',null,'ROLLBACK',null))).rejects.toMatchObject({code:'23514'});expect((await db.query("select id from public.products where barcode='ROLLBACK'")).rows).toEqual([]);}finally{await db.exec('alter table public.product_audit_logs drop constraint test_audit_failure');}});

let stockProduct:string;
const stockKey='20000000-0000-4000-8000-000000000001';
async function adjust(id:string,delta:number,expected:number,key=stockKey,reason='รับสินค้าเข้า'){
 const r=await db.query<{result:{id:string;quantity:number;version:number}}> ('select public.adjust_product_stock($1,$2,$3,$4,$5,$6) as result',[id,delta,reason,expected,key,requestId]);return r.rows[0]!.result;
}
it('stock adjustment records before/after, actor/time/reason and audit atomically',async()=>{
 stockProduct=(await as(owner,()=>mutate('create',null,'STOCK',null))).id;
 expect(await as(owner,()=>adjust(stockProduct,5,1))).toMatchObject({quantity:5,version:2});
 const history=await as(owner,()=>db.query<{quantity_before:number;quantity_after:number;quantity_delta:number;performed_by:string;reason:string;created_at:unknown}>('select quantity_before,quantity_after,quantity_delta,performed_by,reason,created_at from public.stock_movements where product_id=$1',[stockProduct]));
 expect(history.rows[0]).toMatchObject({quantity_before:0,quantity_after:5,quantity_delta:5,performed_by:owner,reason:'รับสินค้าเข้า'});expect(history.rows[0]!.created_at).toBeTruthy();
 expect((await db.query("select id from public.product_audit_logs where product_id=$1 and action='STOCK_ADJUST'",[stockProduct])).rows).toHaveLength(1);
});
it('same idempotency key replay does not adjust or log twice',async()=>{expect(await as(owner,()=>adjust(stockProduct,5,1))).toMatchObject({quantity:5,version:2});expect((await db.query('select id from public.stock_movements where product_id=$1',[stockProduct])).rows).toHaveLength(1);await expect(as(owner,()=>adjust(stockProduct,6,1))).rejects.toMatchObject({code:'PT409'});});
it('stock cannot become negative; stale versions do not change quantity',async()=>{const key='20000000-0000-4000-8000-000000000002';await expect(as(owner,()=>adjust(stockProduct,-6,2,key))).rejects.toMatchObject({code:'PT409'});await expect(as(owner,()=>adjust(stockProduct,1,1,key))).rejects.toMatchObject({code:'PT409'});expect((await db.query('select quantity_on_hand from public.products where id=$1',[stockProduct])).rows[0]).toEqual({quantity_on_hand:5});});
it('stock RLS and RPC deny other tenant/non-owner/anonymous and direct ledger writes',async()=>{for(const uid of [other,employee,accountant])expect((await as(uid,()=>db.query('select * from public.stock_movements'))).rows).toEqual([]);await expect(as(other,()=>adjust(stockProduct,1,2,'20000000-0000-4000-8000-000000000003'))).rejects.toMatchObject({code:'PT404'});await expect(as(employee,()=>adjust(stockProduct,1,2))).rejects.toMatchObject({code:'PT403'});await expect(as(owner,()=>adjust(stockProduct,1,2),true)).rejects.toMatchObject({code:'42501'});await expect(as(owner,()=>db.query('delete from public.stock_movements'))).rejects.toMatchObject({code:'42501'});});
it('stock adjustment supports decrement and preserves history after product deletion',async()=>{expect(await as(owner,()=>adjust(stockProduct,-2,2,'20000000-0000-4000-8000-000000000004','สินค้าชำรุด'))).toMatchObject({quantity:3,version:3});await as(owner,()=>mutate('delete',stockProduct,'STOCK',null,3));const rows=await as(owner,()=>db.query('select quantity_before,quantity_after,performed_by from public.stock_movements where product_id=$1 order by quantity_before',[stockProduct]));expect(rows.rows).toHaveLength(2);expect(rows.rows[1]).toMatchObject({quantity_before:5,quantity_after:3,performed_by:owner});await expect(as(owner,()=>adjust(stockProduct,1,4,'20000000-0000-4000-8000-000000000005'))).rejects.toMatchObject({code:'PT404'});});
it('failed stock audit rolls back quantity, movement and idempotency record together',async()=>{const id=(await as(owner,()=>mutate('create',null,'STOCK-ROLLBACK',null))).id;await db.exec("alter table public.product_audit_logs add constraint stock_audit_failure check (action<>'STOCK_ADJUST') not valid");try{await expect(as(owner,()=>adjust(id,10,1,'20000000-0000-4000-8000-000000000006'))).rejects.toMatchObject({code:'23514'});expect((await db.query('select quantity_on_hand,row_version from public.products where id=$1',[id])).rows[0]).toMatchObject({quantity_on_hand:0,row_version:1});expect((await db.query('select id from public.stock_movements where product_id=$1',[id])).rows).toHaveLength(0);}finally{await db.exec('alter table public.product_audit_logs drop constraint stock_audit_failure');}});
it('RPC rejects zero adjustments and missing reasons',async()=>{const id=(await as(owner,()=>mutate('create',null,'STOCK-INVALID',null))).id;await expect(as(owner,()=>adjust(id,0,1))).rejects.toMatchObject({code:'PT400'});await expect(as(owner,()=>adjust(id,1,1,stockKey,'   '))).rejects.toMatchObject({code:'PT400'});});

it('employee catalog projection hides cost, deleted records and other tenants',async()=>{
 const a=await as(owner,()=>mutate('create',null,'009-catalog',null));
 const b=await as(other,()=>mutate('create',null,'009-catalog',null));
 const list=async(uid:string,search='',barcode:string|null=null,categoryId:string|null=null)=>as(uid,()=>db.query<{result:{items:Record<string,unknown>[];total:number}}>('select public.list_pos_products(1,10,$1,$2,$3) as result',[search,barcode,categoryId]));
 const first=(await list(employee,'','009-catalog')).rows[0]!.result;
 expect(first.total).toBe(1);expect(first.items[0]).toMatchObject({id:a.id,barcode:'009-catalog',salePrice:'12.00'});
 expect(Object.keys(first.items[0]!).sort()).toEqual(['barcode','categoryId','id','imageUrl','name','quantityOnHand','rowVersion','salePrice'].sort());
 expect((await list(other,'','009-catalog')).rows[0]!.result.items[0]!.id).toBe(b.id);
 expect((await list(employee,'','009-catalog',category)).rows[0]!.result.total).toBe(0);
 expect((await list(employee,'%','009-catalog')).rows[0]!.result.total).toBe(0);
 expect((await list(employee,'cOfFeE','009-catalog')).rows[0]!.result.total).toBe(1);
 await expect(list(accountant)).rejects.toMatchObject({code:'PT403'});
 await expect(as(employee,()=>db.query('select public.list_pos_products()'),true)).rejects.toThrow();
 await db.query("update public.organization_members set status='SUSPENDED' where user_id=$1",[employee]);
 await expect(list(employee)).rejects.toMatchObject({code:'PT403'});
 await db.query("update public.organization_members set status='ACTIVE' where user_id=$1",[employee]);
 await as(owner,()=>mutate('delete',a.id,'009-catalog',null,a.version));
 expect((await list(employee,'','009-catalog')).rows[0]!.result.total).toBe(0);
});

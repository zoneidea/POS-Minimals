import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
import {productCreate,productUpdate} from '../apps/api/src/modules/products/schema';
import {stockInput} from '../apps/api/src/modules/stock/schema';
it('validates opening stock on create only and accepts an omitted or empty adjustment reason',()=>{
 const product={barcode:'001',name:'Coffee',categoryId:null,salePrice:'22.00',unitCost:'5.00'};
 expect(productCreate.parse({...product,initialQuantity:12}).initialQuantity).toBe(12);
 for(const initialQuantity of [-1,1.5,2147483648])expect(productCreate.safeParse({...product,initialQuantity}).success).toBe(false);
 expect(productUpdate.safeParse({...product,initialQuantity:12,expectedVersion:1}).success).toBe(false);
 expect(stockInput.parse({delta:1,expectedVersion:1}).reason).toBe('');
 expect(stockInput.parse({delta:1,expectedVersion:1,reason:'  '}).reason).toBe('');
 expect(stockInput.safeParse({delta:1,expectedVersion:1,reason:'x'.repeat(501)}).success).toBe(false);
});
it('creates opening stock atomically with audit and allows blank reasons without weakening ownership or idempotency',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',employee='00000000-0000-4000-8000-000000000003',req='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,fn:()=>Promise<any>)=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await fn();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const name of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 for(const id of [owner,other,employee])await db.query('insert into auth.users values($1,now())',[id]);
 const org=(await as(owner,()=>db.query<any>("select bootstrap_org('Test','Owner',$1) r",[req]))).rows[0].r.orgId;
 await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,employee]);
 const create=(uid=owner,quantity=12)=>as(uid,()=>db.query<any>("select create_product_with_stock('create',null,'001','Coffee',null,22,5,null,$1,$2) r",[req,quantity]));
 await expect(create(employee)).rejects.toMatchObject({code:'PT403'});await expect(create(owner,-1)).rejects.toMatchObject({code:'PT400'});
 const product=(await create()).rows[0].r;expect(product).toMatchObject({quantity:12,version:2});
 const move=(await db.query<any>('select quantity_before,quantity_after,quantity_delta,performed_by,created_at,reason from stock_movements where product_id=$1',[product.id])).rows[0];
 expect(move).toMatchObject({quantity_before:0,quantity_after:12,quantity_delta:12,performed_by:owner,reason:'จำนวนสินค้าเริ่มต้น'});expect(move.created_at).toBeTruthy();
 expect((await db.query<any>("select count(*)::int n from product_audit_logs where product_id=$1",[product.id])).rows[0].n).toBe(2);
 await expect(create()).rejects.toMatchObject({code:'PT409'});expect((await db.query<any>('select count(*)::int n from products')).rows[0].n).toBe(1);
 const key='10000000-0000-4000-8000-000000000002';
 const adjust=(uid=owner,reason='')=>as(uid,()=>db.query<any>('select adjust_product_stock($1,3,$2,2,$3,$4) r',[product.id,reason,key,req]));
 await expect(adjust(other)).rejects.toMatchObject({code:'PT403'});expect((await adjust()).rows[0].r.quantity).toBe(15);expect((await adjust()).rows[0].r.quantity).toBe(15);
 await expect(adjust(owner,'changed')).rejects.toMatchObject({code:'PT409'});
 expect((await db.query<any>('select reason,quantity_before,quantity_after,performed_by from stock_movements where request_key=$1',[key])).rows[0]).toMatchObject({reason:'',quantity_before:12,quantity_after:15,performed_by:owner});
 // Force a failure after product creation to prove the whole RPC rolls back.
 await db.exec("create function private.fail_stock_test() returns trigger language plpgsql as $$begin raise exception 'test stock failure';end;$$;create trigger fail_stock before insert on stock_movements for each row execute function private.fail_stock_test();");
 await expect(as(owner,()=>db.query("select create_product_with_stock('create',null,'002','Rollback',null,22,5,null,$1,1)",[req]))).rejects.toThrow('test stock failure');
 expect((await db.query<any>("select count(*)::int n from products where barcode='002'")).rows[0].n).toBe(0);
 await db.exec('set role anon');await expect(db.query("select create_product_with_stock('create',null,'003','Denied',null,22,5,null,$1,1)",[req])).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);

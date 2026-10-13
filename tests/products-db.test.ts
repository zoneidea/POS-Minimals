import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
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
 db=new PGlite({extensions:{pg_trgm}});await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));
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
 expect(Object.keys(first.items[0]!).sort()).toEqual(['barcode','categoryId','id','imageUrl','imagePath','name','quantityOnHand','rowVersion','salePrice'].sort());
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

it('quotes latest employee-visible prices/VAT without writing or reserving stock',async()=>{
 const row=await as(owner,()=>mutate('create',null,'quote-cash',null, null,'10.00'));
 await as(owner,()=>adjust(row.id,10,row.version,'50000000-0000-4000-8000-000000000001'));
 const input=[{productId:row.id,quantity:2}];
 const quote=async(uid=employee,discount='0.00',items=input)=>as(uid,()=>db.query<{result:{items:Record<string,unknown>[];subtotalAmount:string;totalAmount:string;vatAmount:string;quoteFingerprint:string}}>('select public.quote_cash_sale($1,$2) as result',[JSON.stringify(items),discount]));
 const before=await db.query('select quantity_on_hand,row_version from public.products where id=$1',[row.id]);
 const first=(await quote()).rows[0]!.result;expect(first).toMatchObject({subtotalAmount:'20.00',totalAmount:'20.00',vatAmount:'0.00'});expect(first.items[0]).not.toHaveProperty('unitCost');
 await db.query('update public.store_settings set vat_enabled=true,vat_rate=7 where org_id=$1',[orgA]);
 expect((await quote(employee,'10.00')).rows[0]!.result).toMatchObject({totalAmount:'10.00',vatAmount:'0.65'});
 expect((await db.query('select quantity_on_hand,row_version from public.products where id=$1',[row.id])).rows).toEqual(before.rows);
 await expect(quote(other)).rejects.toMatchObject({code:'PT409'});await expect(quote(accountant)).rejects.toMatchObject({code:'PT403'});
 await expect(as(employee,()=>db.query('select public.quote_cash_sale($1,$2)',[JSON.stringify(input),'0.00']),true)).rejects.toThrow();
 await expect(quote(employee,'21.00')).rejects.toMatchObject({code:'PT400'});
 await expect(quote(employee,'0.00',[{productId:row.id,quantity:11}])).rejects.toMatchObject({code:'PT409'});
 await expect(quote(employee,'0.00',[...input,...input])).rejects.toMatchObject({code:'PT400'});
 const version=(await db.query<{row_version:number}>('select row_version from public.products where id=$1',[row.id])).rows[0]!.row_version;
 await as(owner,()=>mutate('update',row.id,'quote-cash',null,version,'12.00'));
 expect((await quote()).rows[0]!.result.subtotalAmount).toBe('24.00');
 await db.query("update public.organization_members set status='SUSPENDED' where user_id=$1",[employee]);await expect(quote()).rejects.toMatchObject({code:'PT403'});await db.query("update public.organization_members set status='ACTIVE' where user_id=$1",[employee]);
});

it('cash checkout commits stock, immutable snapshots, payment and replay atomically',async()=>{
 const a=await as(owner,()=>mutate('create',null,'sale-cash-a',null,null,'10.00'));
 const b=await as(owner,()=>mutate('create',null,'sale-cash-b',null,null,'0.00'));
 await as(owner,()=>adjust(a.id,10,1,'60000000-0000-4000-8000-000000000001'));
 await as(owner,()=>adjust(b.id,10,1,'60000000-0000-4000-8000-000000000002'));
 const key='60000000-0000-4000-8000-000000000003';
 const input={items:[{productId:a.id,quantity:2,expectedUnitPrice:'10.00',expectedVersion:2},{productId:b.id,quantity:1,expectedUnitPrice:'0.00',expectedVersion:2}],discountAmount:'1.00',expectedTotalAmount:'19.00',payment:{method:'CASH',receivedAmount:'20.00'}};
 const commit=async(uid=employee,body=input,requestKey=key)=>as(uid,()=>db.query<{result:{saleId:string;replayed:boolean;changeAmount:string;receipt:{items:{productName:string;lineTotal:string}[]}}}>('select public.checkout_cash_sale($1,$2,$3,$4) as result',[JSON.stringify(body),requestKey,requestId,'encrypted-fixture-identity']));
 const sale=(await commit()).rows[0]!.result;expect(sale).toMatchObject({replayed:false,changeAmount:'1.00'});
 expect((await db.query<{quantity_on_hand:number}>('select quantity_on_hand from public.products where id=$1',[a.id])).rows[0]!.quantity_on_hand).toBe(8);
 expect((await commit()).rows[0]!.result).toMatchObject({saleId:sale.saleId,replayed:true});
 expect((await db.query('select id from public.stock_movements where sale_id=$1',[sale.saleId])).rows).toHaveLength(2);
 expect((await db.query<{sum:string}>('select sum(discount_amount)::text as sum from public.sale_items where sale_id=$1',[sale.saleId])).rows[0]!.sum).toBe('1.00');
 expect((await db.query('select id from public.payments where sale_id=$1',[sale.saleId])).rows).toHaveLength(1);
 await expect(commit(employee,{...input,payment:{method:'CASH',receivedAmount:'30.00'}})).rejects.toMatchObject({code:'PT409'});
 await expect(commit(other)).rejects.toMatchObject({code:'PT409'});
 await expect(commit(accountant)).rejects.toMatchObject({code:'PT403'});
 expect((await as(other,()=>db.query('select id from public.sales'))).rows).toEqual([]);
 expect((await as(employee,()=>db.query('select id from public.sales'))).rows).toHaveLength(1);
 expect((await as(employee,()=>db.query('select unit_cost from public.sale_items'))).rows).toEqual([]);
 await expect(as(employee,()=>db.query('delete from public.sales'))).rejects.toThrow();
 await expect(commit(employee,input,'60000000-0000-4000-8000-000000000004')).rejects.toMatchObject({code:'PT409'});
 const latest={...input,items:input.items.map(item=>({...item,expectedVersion:3}))};
 await expect(commit(employee,{...latest,payment:{method:'CASH',receivedAmount:'0.00'}},'60000000-0000-4000-8000-000000000005')).rejects.toMatchObject({code:'PT400'});
 await db.exec("alter table public.activity_logs add constraint fail_sale_log check(action<>'SALE_COMPLETED') not valid");
 await expect(commit(employee,latest,'60000000-0000-4000-8000-000000000006')).rejects.toThrow();
 expect((await db.query<{quantity_on_hand:number}>('select quantity_on_hand from public.products where id=$1',[a.id])).rows[0]!.quantity_on_hand).toBe(8);
 expect((await db.query('select id from public.sales')).rows).toHaveLength(1);
 await db.exec('alter table public.activity_logs drop constraint fail_sale_log');
 await as(owner,()=>mutate('update',a.id,'sale-cash-a',null,3,'15.00'));
 expect((await commit()).rows[0]!.result.receipt.items[0]!.lineTotal).toBe('19.00');
});

it('keeps images optional and enforces tenant/role/private-path image attachment',async()=>{
 const row=await as(owner,()=>mutate('create',null,'image-optional',null));
 const path=`${orgA}/${row.id}/70000000-0000-4000-8000-000000000001.webp`;
 expect((await db.query<{image_path:string|null}>('select image_path from public.products where id=$1',[row.id])).rows[0]!.image_path).toBeNull();
 await as(owner,()=>db.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[path]));
 expect((await as(employee,()=>db.query('select name from storage.objects'))).rows).toEqual([]);
 await expect(as(employee,()=>db.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[path.replace('000000000001.webp','000000000002.webp')]))).rejects.toThrow();
 const attach=(uid:string,value=path,version=1)=>as(uid,()=>db.query<{result:{imagePath:string;version:number}}>('select public.set_product_image($1,$2,$3,$4) as result',[row.id,value,version,requestId]));
 await expect(attach(other)).rejects.toMatchObject({code:'PT400'});
 await expect(attach(employee)).rejects.toMatchObject({code:'PT403'});
 expect((await attach(owner)).rows[0]!.result).toMatchObject({imagePath:path,version:2});
 expect((await as(employee,()=>db.query('select name from storage.objects'))).rows).toEqual([{name:path}]);
 expect((await as(other,()=>db.query('select name from storage.objects'))).rows).toEqual([]);
 expect((await as(accountant,()=>db.query('select name from storage.objects'))).rows).toEqual([]);
 await expect(attach(owner,path,1)).rejects.toMatchObject({code:'PT409'});
 await expect(as(owner,()=>db.query('delete from storage.objects'))).rejects.toThrow();
 await as(owner,()=>mutate('delete',row.id,'image-optional',null,2));
 expect((await as(employee,()=>db.query('select name from storage.objects'))).rows).toEqual([]);
 expect((await db.query('select name from storage.objects')).rows).toEqual([{name:path}]);
});

it('owner void restores latest stock once, preserves soft-deleted product and immutable payment/sale snapshots',async()=>{
 const sale=(await db.query<{id:string;result_json:unknown}>('select id,result_json from public.sales limit 1')).rows[0]!;
 const productIds=(await db.query<{product_id:string}>('select product_id from public.sale_items where sale_id=$1',[sale.id])).rows.map(row=>row.product_id);
 const id=productIds[0]!;
 const current=(await db.query<{row_version:number}>('select row_version from public.products where id=$1',[id])).rows[0]!;
 await as(owner,()=>adjust(id,3,current.row_version,'80000000-0000-4000-8000-000000000001'));
 const before=(await db.query<{id:string;quantity_on_hand:number}>('select id,quantity_on_hand from public.products where id=any($1) order by id',[productIds])).rows;
 await db.query('update public.products set deleted_at=now(),deleted_by=$1 where id=$2',[owner,id]);
 const cancel=(uid=owner,reason='ลูกค้าขอยกเลิก')=>as(uid,()=>db.query<{result:{status:string;replayed:boolean}}>('select public.void_sale($1,$2,$3) as result',[sale.id,reason,requestId]));
 for(const uid of [employee,accountant])await expect(cancel(uid)).rejects.toMatchObject({code:'PT403'});
 await expect(cancel(other)).rejects.toMatchObject({code:'PT404'});
 await expect(cancel(owner,' ')).rejects.toMatchObject({code:'PT400'});
 await db.exec("alter table public.activity_logs add constraint fail_void_log check(action<>'SALE_VOIDED') not valid");
 try{await expect(cancel()).rejects.toThrow();
 expect((await db.query('select id from public.sale_void_logs')).rows).toHaveLength(0);
 expect((await db.query('select id,quantity_on_hand from public.products where id=any($1) order by id',[productIds])).rows).toEqual(before);
 }finally{await db.exec('alter table public.activity_logs drop constraint fail_void_log');}
 expect((await cancel()).rows[0]!.result).toMatchObject({status:'VOIDED',replayed:false});
 expect((await cancel()).rows[0]!.result.replayed).toBe(true);
 await expect(cancel(owner,'different')).rejects.toMatchObject({code:'PT409'});
 const moves=(await db.query<{product_id:string;quantity_delta:number;quantity_before:number;quantity_after:number;performed_by:string}>('select product_id,quantity_delta,quantity_before,quantity_after,performed_by from public.stock_movements where sale_id=$1 and movement_type=$2',[sale.id,'SALE_VOID_IN'])).rows;
 expect(moves).toHaveLength(2);for(const move of moves){expect(move.performed_by).toBe(owner);expect(move.quantity_after).toBe(move.quantity_before+move.quantity_delta);expect(move.quantity_before).toBe(before.find(row=>row.id===move.product_id)!.quantity_on_hand);}
 expect((await db.query<{result_json:unknown}>('select result_json from public.sales where id=$1',[sale.id])).rows[0]!.result_json).toEqual(sale.result_json);
 expect((await db.query('select id from public.payments where sale_id=$1',[sale.id])).rows).toHaveLength(1);
 expect((await as(other,()=>db.query('select * from public.sale_void_logs'))).rows).toEqual([]);
 await expect(as(owner,()=>db.query('delete from public.sale_void_logs'))).rejects.toThrow();
});
it('void window uses completed UTC time, rejects expired without changing stock',async()=>{
 const id=(await as(owner,()=>mutate('create',null,'void-window',null,null,'1.00'))).id;
 await as(owner,()=>adjust(id,5,1,'80000000-0000-4000-8000-000000000002'));
 const body={items:[{productId:id,quantity:1,expectedUnitPrice:'1.00',expectedVersion:2}],discountAmount:'0.00',expectedTotalAmount:'1.00',payment:{method:'CASH',receivedAmount:'1.00'}};
 const sale=(await as(owner,()=>db.query<{result:{saleId:string}}>('select public.checkout_cash_sale($1,$2,$3,$4) as result',[JSON.stringify(body),'80000000-0000-4000-8000-000000000003',requestId,'cipher']))).rows[0]!.result.saleId;
 await db.query("update public.sales set completed_at=(date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')-interval '1 second' where id=$1",[sale]);
 const cancel=()=>as(owner,()=>db.query('select public.void_sale($1,$2,$3)',[sale,'test',requestId]));
 await expect(cancel()).rejects.toMatchObject({code:'PT409',message:'VOID_WINDOW_EXPIRED'});
 expect((await db.query('select quantity_on_hand from public.products where id=$1',[id])).rows[0]).toEqual({quantity_on_hand:4});
 await db.query("update public.sales set completed_at=now()-interval '1 second' where id=$1",[sale]);
 await cancel();expect((await db.query('select quantity_on_hand from public.products where id=$1',[id])).rows[0]).toEqual({quantity_on_hand:5});
});

it('indexed catalog keeps literal wildcard/backslash search, stable pages and exact barcode semantics',async()=>{
 const ids:string[]=[];
 for(let n=0;n<12;n++){const row=await as(owner,()=>mutate('create',null,'perf-'+String(n).padStart(2,'0'),null));ids.push(row.id);await db.query('update public.products set name=$1 where id=$2',["Literal % _ "+String.fromCharCode(92)+" ' "+String(n).padStart(2,'0'),row.id]);}
 for(const search of ['Literal %',' _ ',String.fromCharCode(92),"'"]){const page=async(n:number)=>(await as(employee,()=>db.query<{result:any}>('select public.list_pos_products($1,10,$2) result',[n,search]))).rows[0]!.result;const first=await page(1),second=await page(2);expect(first.total).toBe(12);expect(first.items).toHaveLength(10);expect(second.items).toHaveLength(2);expect(new Set([...first.items,...second.items].map((p:any)=>p.id)).size).toBe(12);}
 const exact=(await as(employee,()=>db.query<{result:any}>("select public.list_pos_products(1,10,'Literal %','perf-00') result"))).rows[0]!.result;
 expect(exact.total).toBe(1);expect(exact.items[0].id).toBe(ids[0]);
});

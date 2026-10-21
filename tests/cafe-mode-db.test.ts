import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('creates and switches shop modes atomically, retaining daily queues, replay, tenant and retail invariants',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003',request='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 const rpc=async(uid:string,sql:string,args:unknown[]=[])=> (await as(uid,sql+' as result',args)).rows[0].result;
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const n of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'));
 for(const id of [owner,other,staff])await db.query('insert into auth.users values($1,now())',[id]);
 const org=(await rpc(owner,"select bootstrap_org_with_mode('Cafe','Owner',$1,'cipher','CAFE')",[request])).orgId;
 const otherOrg=(await rpc(other,"select bootstrap_org('Retail','Owner',$1)",[request])).orgId;
 await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,staff]);
 await rpc(owner,"select bootstrap_org_with_mode('Retry','Owner',$1,'cipher','RETAIL')",[request]);
 expect((await as(owner,'select store_mode from store_settings')).rows).toEqual([{store_mode:'CAFE'}]);
 expect((await as(other,'select store_mode from store_settings')).rows).toEqual([{store_mode:'RETAIL'}]);
 const settings={storeName:'Cafe',vatEnabled:false,vatRate:'7.00',receiptFooter:'',autoOpenPrintDialog:false,privateCipher:'cipher',storeMode:'CAFE'};
 const save=(uid:string,mode:string,version:number)=>rpc(uid,'select save_store_settings($1,$2,$3)',[{...settings,storeMode:mode},version,request]);
 await expect(save(staff,'RETAIL',1)).rejects.toMatchObject({code:'PT403'});
 await expect(save(owner,'RESTAURANT',1)).rejects.toMatchObject({code:'PT400'});
 await expect(as(owner,"update store_settings set store_mode='RETAIL' where org_id=$1",[org])).rejects.toMatchObject({code:'42501'});
 const product=await rpc(owner,"select create_product_with_stock('create',null,'COFFEE','Coffee',null,20,5,null,$1,20)",[request]);
 let serial=1;
 const post=async(uid=owner,key?:string)=>{const v=(await db.query<any>('select row_version::int v from products where id=$1',[product.id])).rows[0].v;
 const input={items:[{productId:product.id,quantity:1,expectedUnitPrice:'20.00',expectedVersion:v}],discountAmount:'0.00',expectedTotalAmount:'20.00',payment:{method:'CASH',receivedAmount:'25.00'}};
 const k=key??`20000000-0000-4000-8000-${String(serial++).padStart(12,'0')}`;
 return {sale:await rpc(uid,'select checkout_cash_sale($1,$2,$3,$4)',[input,k,request,'cipher']),input,key:k};};
 const first=await post(staff);expect(first.sale.receipt.cafe.queueNo).toBe('A001');expect(first.sale.changeAmount).toBe('5.00');
 const day=first.sale.receipt.cafe.queueDate;
 const replay=await rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[first.input,first.key,request,'cipher']);expect(replay.replayed).toBe(true);expect(replay.receipt.cafe).toEqual(first.sale.receipt.cafe);
 expect((await post()).sale.receipt.cafe.queueNo).toBe('A002');
 await save(owner,'RETAIL',1);await expect(save(owner,'CAFE',1)).rejects.toMatchObject({code:'PT409'});
 expect((await post()).sale.receipt.cafe).toBeUndefined();
 expect((await db.query<any>('select result_json from sales where id=$1',[first.sale.saleId])).rows[0].result_json.receipt.cafe.queueNo).toBe('A001');
 await save(owner,'CAFE',2);expect((await post()).sale.receipt.cafe.queueNo).toBe('A003');
 await rpc(owner,'select save_store_settings($1,3,$2)',[Object.fromEntries(Object.entries(settings).filter(([k])=>k!=='storeMode')),request]);
 expect((await as(owner,'select store_mode from store_settings')).rows[0].store_mode).toBe('CAFE');
 // Paid Gateway shares the same cafe queue while retaining provider verification and payment snapshots.
 const gatewayInput={items:[{productId:product.id,quantity:1,expectedUnitPrice:'20.00',expectedVersion:1}],discountAmount:'0.00',expectedTotalAmount:'20.00',payment:{method:'CASH',receivedAmount:'20.00'}};
 const hash='a'.repeat(64);await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,paid_at,verified_at,verified_fee) values($1,$2,$3,'q','2000','pay_cafe',$4,'cipher',now(),now(),0.30)",[hash,org,owner,gatewayInput]);
 const gateway=await rpc(owner,'select complete_gateway_sale($1,$2)',[hash,request]);expect(gateway.receipt.cafe.queueNo).toBe('A004');expect(gateway.receipt.paymentMethod).toBe('PROMPTPAY');
 expect((await rpc(owner,'select complete_gateway_sale($1,$2)',[hash,request])).receipt.cafe).toEqual(gateway.receipt.cafe);
 await expect(rpc(other,'select complete_gateway_sale($1,$2)',[hash,request])).rejects.toMatchObject({code:'PT403'});
 // A queue failure rolls back the sale, payment and stock together.
 const before=(await db.query<any>('select quantity_on_hand::int q from products where id=$1',[product.id])).rows[0].q;
 await db.exec("create function private.fail_cafe_counter() returns trigger language plpgsql as $$begin raise exception 'counter unavailable';end$$;create trigger fail_cafe before update on cafe_daily_queues for each row execute function private.fail_cafe_counter()");
 await expect(post()).rejects.toThrow('counter unavailable');await db.exec('drop trigger fail_cafe on cafe_daily_queues');
 expect((await db.query<any>('select quantity_on_hand::int q from products where id=$1',[product.id])).rows[0].q).toBe(before);
 expect((await post()).sale.receipt.cafe.queueNo).toBe('A005');
 // Other shops have independent counters; issuing over 999 remains unique.
 await db.query('update cafe_daily_queues set last_number=999 where org_id=$1 and queue_date=$2',[org,day]);expect((await post()).sale.receipt.cafe.queueNo).toBe('A1000');
 expect((await as(other,'select * from cafe_daily_queues').catch(e=>({rows:[],code:e.code}))).rows).toEqual([]);
 await expect(as(staff,'select * from cafe_daily_queues')).rejects.toMatchObject({code:'42501'});
 expect((await db.query<any>("select store_mode from store_settings where org_id=$1",[otherOrg])).rows[0].store_mode).toBe('RETAIL');
 await db.exec('set role anon');await expect(db.query("select bootstrap_org_with_mode('x','x',$1,'cipher','CAFE')",[request])).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);

import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('calculates per-bill 1.5% fees and requires durable scoped provider proof before exactly-once restock',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',accountant='00000000-0000-4000-8000-000000000003',employee='00000000-0000-4000-8000-000000000004',req='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,fn:()=>Promise<any>)=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await fn();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const name of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 for(const id of [owner,other,accountant,employee])await db.query('insert into auth.users values($1,now())',[id]);
 const boot=(uid:string)=>as(uid,()=>db.query<any>("select public.bootstrap_org('Test','Owner',$1) r",[req]));const org=(await boot(owner)).rows[0].r.orgId;await boot(other);
 for(const [id,role] of [[accountant,'ACCOUNTANT'],[employee,'EMPLOYEE']])await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff',$3)",[org,id,role]);
 const product=(await as(owner,()=>db.query<any>("select public.manage_product('create',null,'001','Test',null,'22.00','5.00',null,$1) r",[req]))).rows[0].r.id;
 await db.query('update products set quantity_on_hand=30 where id=$1',[product]);
 const input={items:[{productId:product,quantity:2,expectedUnitPrice:'22.00',expectedVersion:1}],discountAmount:'0.00',expectedTotalAmount:'44.00',payment:{method:'CASH',receivedAmount:'44.00'}};
 const hash='c'.repeat(64);await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,verified_fee,paid_at,verified_at) values($1,$2,$3,'q','4400','pay_void',$4,'cipher',5,now(),now())",[hash,org,owner,JSON.stringify(input)]);
 const sale=(await as(owner,()=>db.query<any>('select complete_gateway_sale($1,$2) r',[hash,req]))).rows[0].r;
 const report=()=>as(owner,()=>db.query<any>("select gateway_sales_report(now()-interval '1 day',now()+interval '1 day',1) r"));
 expect((await report()).rows[0].r).toMatchObject({summary:{gross:'44.00',fees:'0.66',net:'43.34'},items:[{fee:'0.66',net:'43.34'}]});
 // Fee is rounded per bill; provider's stored actual fee remains unchanged.
 expect((await db.query<any>('select gateway_fee::text fee from payments where sale_id=$1',[sale.saleId])).rows[0].fee).toBe('5.00');
 const extra='20000000-0000-4000-8000-000000000099';
 await db.query("insert into sales(id,org_id,sale_no,cashier_id,subtotal_amount,discount_amount,vat_amount,total_amount,request_key,request_id,input_json,result_json,identity_cipher) select $1,org_id,'ROUND',cashier_id,1,0,0,1,gen_random_uuid(),request_id,input_json,result_json,identity_cipher from sales where id=$2",[extra,sale.saleId]);
 await db.query("insert into payments(org_id,sale_id,method,amount,received_amount,change_amount,confirmed_by,provider_payment_id,gateway_fee,gateway_net) values($1,$2,'PROMPTPAY',1,1,0,$3,'pay_round',0,1)",[org,extra,owner]);
 expect((await report()).rows[0].r).toMatchObject({summary:{gross:'45.00',fees:'0.68',net:'44.32'}});
 const prepare=(uid=owner,reason='void')=>as(uid,()=>db.query<any>('select prepare_sale_void($1,$2,$3) r',[sale.saleId,reason,req]));
 const cancel=()=>as(owner,()=>db.query<any>("select void_sale($1,'void',$2) r",[sale.saleId,req]));
 for(const uid of [other,accountant,employee])await expect(prepare(uid)).rejects.toMatchObject({code:uid===other?'PT404':'PT403'});
 await expect(cancel()).rejects.toMatchObject({message:'GATEWAY_VOID_REQUIRES_PROVIDER'});
 await db.query("update sales set completed_at=now()-interval '2 days' where id=$1",[sale.saleId]);await expect(prepare()).rejects.toMatchObject({message:'VOID_WINDOW_EXPIRED'});await db.query('update sales set completed_at=now() where id=$1',[sale.saleId]);
 const first=(await prepare()).rows[0].r;expect(first).toMatchObject({orgId:org,paymentId:'pay_void',amount:'44.00',verified:false});
 await expect(prepare()).rejects.toMatchObject({message:'VOID_IN_PROGRESS'});await expect(prepare(owner,'different')).rejects.toMatchObject({message:'VOID_REASON_CONFLICT'});
 await expect(as(owner,()=>db.query('select verify_gateway_void($1,$2,$3,$4)',[org,sale.saleId,first.attemptId,'pay_void']))).rejects.toMatchObject({code:'42501'});
 await expect(as(owner,()=>db.query('update gateway_sale_voids set verified_at=now()'))).rejects.toMatchObject({code:'42501'});
 await db.query("update gateway_sale_voids set lease_until=now()-interval '1 second' where sale_id=$1",[sale.saleId]);const retry=(await prepare()).rows[0].r;expect(retry.attemptId).not.toBe(first.attemptId);
 const verify=async(attempt:string,payment='pay_void')=>{await db.exec('begin;set local role service_role');try{await db.query('select verify_gateway_void($1,$2,$3,$4)',[org,sale.saleId,attempt,payment]);await db.exec('commit');}catch(e){await db.exec('rollback');throw e;}};
 await expect(verify(first.attemptId)).rejects.toMatchObject({message:'VOID_ATTEMPT_CHANGED'});await expect(verify(retry.attemptId,'pay_other')).rejects.toMatchObject({message:'VOID_ATTEMPT_CHANGED'});
 await verify(retry.attemptId);expect((await prepare()).rows[0].r.verified).toBe(true);
 // Resume local completion after midnight only when provider evidence already exists.
 await db.query("update sales set completed_at=now()-interval '2 days' where id=$1",[sale.saleId]);
 expect((await cancel()).rows[0].r.replayed).toBe(false);expect((await cancel()).rows[0].r.replayed).toBe(true);
 expect((await db.query<any>('select quantity_on_hand from products where id=$1',[product])).rows[0].quantity_on_hand).toBe(30);
 expect((await db.query<any>("select count(*)::int n from stock_movements where sale_id=$1 and movement_type='SALE_VOID_IN'",[sale.saleId])).rows[0].n).toBe(1);
 expect((await db.query<any>('select count(*)::int n from sale_void_logs where sale_id=$1',[sale.saleId])).rows[0].n).toBe(1);
 expect((await report()).rows[0].r).toMatchObject({total:1,summary:{gross:'1.00',fees:'0.02',net:'0.98'}});
 expect((await prepare()).rows[0].r.paymentId).toBeNull();
 }finally{await db.close();}
},30000);

import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('records cash refund and restocks once with owner/tenant/day guards, retaining the gateway payment',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',employee='00000000-0000-4000-8000-000000000003',req='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,fn:()=>Promise<any>)=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await fn();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 try{
  await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const name of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
  for(const id of [owner,other,employee])await db.query('insert into auth.users values($1,now())',[id]);
  const boot=(uid:string)=>as(uid,()=>db.query<any>("select bootstrap_org('Test','Owner',$1) r",[req]));const org=(await boot(owner)).rows[0].r.orgId;await boot(other);
  await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,employee]);
  const product=(await as(owner,()=>db.query<any>("select manage_product('create',null,'001','Test',null,'22.00','5.00',null,$1) r",[req]))).rows[0].r.id;await db.query('update products set quantity_on_hand=30 where id=$1',[product]);
  const input={items:[{productId:product,quantity:2,expectedUnitPrice:'22.00',expectedVersion:1}],discountAmount:'0.00',expectedTotalAmount:'44.00',payment:{method:'CASH',receivedAmount:'44.00'}},hash='e'.repeat(64);
  await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,verified_fee,paid_at,verified_at) values($1,$2,$3,'q','4400','pay_cash_refund',$4,'cipher',0.66,now(),now())",[hash,org,owner,JSON.stringify(input)]);
  const sale=(await as(owner,()=>db.query<any>('select complete_gateway_sale($1,$2) r',[hash,req]))).rows[0].r;
  const cancel=(uid=owner)=>as(uid,()=>db.query<any>("select void_sale_cash_refund($1,'staff cash refund',$2) r",[sale.saleId,req]));
  await expect(cancel(employee)).rejects.toMatchObject({code:'PT403'});await expect(cancel(other)).rejects.toMatchObject({code:'PT404'});
  await db.query("update sales set completed_at=now()-interval '2 days' where id=$1",[sale.saleId]);await expect(cancel()).rejects.toMatchObject({message:'VOID_WINDOW_EXPIRED'});expect((await db.query('select * from gateway_cash_refunds')).rows).toHaveLength(0);await db.query('update sales set completed_at=now() where id=$1',[sale.saleId]);
  await db.query('update products set quantity_on_hand=2147483647 where id=$1',[product]);await expect(cancel()).rejects.toMatchObject({message:'STOCK_LIMIT_EXCEEDED'});expect((await db.query('select * from gateway_cash_refunds')).rows).toHaveLength(0);await db.query('update products set quantity_on_hand=28 where id=$1',[product]);
  expect((await cancel()).rows[0].r.replayed).toBe(false);expect((await cancel()).rows[0].r.replayed).toBe(true);
  expect((await db.query<any>('select quantity_on_hand from products where id=$1',[product])).rows[0].quantity_on_hand).toBe(30);
  expect((await db.query<any>('select payment_id,amount::text from gateway_cash_refunds')).rows).toEqual([{payment_id:'pay_cash_refund',amount:'44.00'}]);
  expect((await db.query<any>('select provider_payment_id,method from payments where sale_id=$1',[sale.saleId])).rows[0]).toEqual({provider_payment_id:'pay_cash_refund',method:'PROMPTPAY'});
  expect((await db.query<any>('select count(*)::int n from gateway_sale_voids')).rows[0].n).toBe(0);
  await db.exec('set role authenticated');await expect(db.query('insert into gateway_cash_refunds default values')).rejects.toMatchObject({code:'42501'});await db.exec('set role anon');await expect(db.query('select void_sale_cash_refund($1,$2,$3)',[sale.saleId,'x',req])).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);

import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('posts only verified payments atomically, replays once, isolates reports and blocks local Gateway void',async()=>{
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
 const hash='a'.repeat(64);await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher) values($1,$2,$3,'q','4400','pay_test',$4,'test-encrypted-identity')",[hash,org,owner,JSON.stringify(input)]);
 const complete=(uid=owner,h=hash)=>as(uid,()=>db.query<any>('select complete_gateway_sale($1,$2) r',[h,req]));
 await expect(complete()).rejects.toMatchObject({code:'PT409'});await expect(complete(other)).rejects.toMatchObject({code:'PT403'});
 await db.query("update reservepay_payment_sessions set verified_fee=0.66,paid_at='2026-10-15T16:59:59Z',verified_at=now() where session_hash=$1",[hash]);
 await db.query("update reservepay_payment_sessions set verified_at=now()-interval '5 minutes' where session_hash=$1",[hash]);await expect(complete()).rejects.toMatchObject({code:'PT409'});await db.query('update reservepay_payment_sessions set verified_at=now() where session_hash=$1',[hash]);
 await expect(as(owner,()=>db.query('select private.checkout_gateway_core($1,$2,$3,$4)',[JSON.stringify(input),req,req,'cipher']))).rejects.toMatchObject({code:'42501'});
 await db.query('update products set row_version=row_version+1 where id=$1',[product]);
 const sale=(await complete()).rows[0].r;expect(sale.receipt.paymentMethod).toBe('PROMPTPAY');expect((await complete()).rows[0].r.replayed).toBe(true);expect((await db.query<any>('select quantity_on_hand from products where id=$1',[product])).rows[0].quantity_on_hand).toBe(28);
 expect((await db.query<any>('select method,gateway_fee::text,gateway_net::text from payments where sale_id=$1',[sale.saleId])).rows[0]).toEqual({method:'PROMPTPAY',gateway_fee:'0.66',gateway_net:'43.34'});
 const report=(uid:string,from='2026-10-14T17:00:00Z',to='2026-10-15T17:00:00Z')=>as(uid,()=>db.query<any>('select gateway_sales_report($1,$2,1) r',[from,to]));
 expect((await report(owner)).rows[0].r).toMatchObject({total:1,summary:{gross:'44.00',fees:'0.66',net:'43.34'}});expect((await report(accountant)).rows[0].r.total).toBe(1);expect((await report(other)).rows[0].r.total).toBe(0);await expect(report(employee)).rejects.toMatchObject({code:'PT403'});expect((await report(owner,'2026-10-15T17:00:00Z','2026-10-16T17:00:00Z')).rows[0].r.total).toBe(0);
 await expect(as(owner,()=>db.query('select void_sale($1,$2,$3)',[sale.saleId,'void',req]))).rejects.toMatchObject({code:'PT409',message:'GATEWAY_VOID_REQUIRES_PROVIDER'});
 // Paid-but-unpostable cart rolls back every stock and sales write, retaining proof for review.
 await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,verified_fee,paid_at,verified_at) values($1,$2,$3,'q','4400','pay_second',$4,'cipher',0.66,now(),now())",['b'.repeat(64),org,owner,JSON.stringify(input)]);
 await db.query('update products set sale_price=23.00 where id=$1',[product]);
 await expect(complete(owner,'b'.repeat(64))).rejects.toMatchObject({code:'PT409'});expect((await db.query<any>('select count(*)::int n from sales')).rows[0].n).toBe(1);

 // Summaries cover every filtered bill, while each page has at most ten rows.
 for(let i=0;i<10;i++){const sid='20000000-0000-4000-8000-'+String(i+1).padStart(12,'0');await db.query("insert into sales(id,org_id,sale_no,cashier_id,status,subtotal_amount,discount_amount,vat_amount,total_amount,completed_at,request_key,request_id,input_json,result_json,identity_cipher,voided_at,voided_by,void_reason) select $1,org_id,'BTEST'||$2,cashier_id,status,subtotal_amount,discount_amount,vat_amount,total_amount,completed_at,gen_random_uuid(),request_id,input_json,result_json,identity_cipher,voided_at,voided_by,void_reason from sales where id=$3",[sid,String(i),sale.saleId]);await db.query("insert into payments(org_id,sale_id,method,amount,received_amount,change_amount,confirmed_by,provider_payment_id,gateway_fee,gateway_net) values($1,$2,'PROMPTPAY',44,44,0,$3,$4,0.66,43.34)",[org,sid,owner,'pay_extra'+i]);}
 const all=(await report(owner)).rows[0].r;expect(all).toMatchObject({total:11,summary:{gross:'484.00',fees:'7.26',net:'476.74'}});expect(all.items).toHaveLength(10);const page2=(await as(owner,()=>db.query<any>("select gateway_sales_report('2026-10-14T17:00:00Z','2026-10-15T17:00:00Z',2) r"))).rows[0].r;expect(page2.items).toHaveLength(1);expect(page2.summary).toEqual(all.summary);
 await db.exec('set role anon');await expect(db.query("select complete_gateway_sale('x',$1)",[req])).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);

import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('gates demo coupons by tenant/role, consumes once with checkout, rolls back failures and restores on void',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003',account='00000000-0000-4000-8000-000000000004',req='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,fn:()=>Promise<any>)=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await fn();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 const rpc=async(uid:string,sql:string,args:unknown[]=[])=>((await as(uid,()=>db.query<any>(sql+' r',args))).rows[0]?.r);
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const n of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'));
 for(const id of [owner,other,staff,account])await db.query('insert into auth.users values($1,now())',[id]);
 const org=(await rpc(owner,"select bootstrap_org('Test','Owner',$1)",[req])).orgId;await rpc(other,"select bootstrap_org('Other','Other',$1)",[req]);
 for(const [id,role] of [[staff,'EMPLOYEE'],[account,'ACCOUNTANT']])await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff',$3)",[org,id,role]);
 await expect(rpc(owner,'select list_coupons(1)')).rejects.toMatchObject({code:'PT403',message:'MODULE_NOT_ACTIVE'});
 await expect(rpc(staff,'select demo_purchase_coupons($1)',[req])).rejects.toMatchObject({code:'PT403'});
 expect(await rpc(owner,'select demo_purchase_coupons($1)',[req])).toEqual({coupons:true});await rpc(owner,'select demo_purchase_coupons($1)',[req]);
 expect((await db.query<any>("select count(*)::int n from activity_logs where action='MODULE_DEMO_PURCHASED'")).rows[0].n).toBe(1);
 const day=(await db.query<any>("select (now() at time zone 'Asia/Bangkok')::date::text d")).rows[0].d;
 const input={name:'Welcome',code:'SAVE10',amount:'10.00',startsOn:day,endsOn:day,maxUses:1,showOnReceipt:true};
 const manage=(uid:string,action:string,id:string|null,data:unknown)=>rpc(uid,'select manage_coupon($1,$2,$3,$4)',[action,id,JSON.stringify(data),req]);
 const c=await manage(owner,'CREATE',null,input);await expect(manage(staff,'CREATE',null,{...input,code:'OTHER'})).rejects.toMatchObject({code:'PT403'});await expect(manage(owner,'CREATE',null,input)).rejects.toMatchObject({code:'PT409'});
 await expect(manage(other,'UPDATE',c.id,{...input,version:1})).rejects.toMatchObject({code:'PT403'});
 const product=(await rpc(owner,"select create_product_with_stock('create',null,'001','Coffee',null,22,5,null,$1,20)",[req]));
 const cart=[{productId:product.id,quantity:1}],q=await rpc(staff,'select quote_coupon_sale($1,$2,$3)',[JSON.stringify(cart),'2.00','SAVE10']);
 expect(q).toMatchObject({discountAmount:'12.00',manualDiscountAmount:'2.00',couponDiscountAmount:'10.00',totalAmount:'10.00'});
 const checkout={items:[{...cart[0],expectedUnitPrice:'22.00',expectedVersion:2}],discountAmount:'2.00',couponCode:'SAVE10',expectedTotalAmount:'10.00',payment:{method:'CASH',receivedAmount:'20.00'}};
 const post=(data=checkout,key=req)=>rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[JSON.stringify(data),key,req,'cipher']);
 await expect(post({...checkout,expectedTotalAmount:'9.00'})).rejects.toMatchObject({code:'PT409'});
 expect((await rpc(owner,'select list_coupons(1)')).items[0].usedCount).toBe(0);
 const sale=await post();expect(sale.receipt).toMatchObject({coupon:{code:'SAVE10',amount:'10.00'},couponOffers:[],totals:{discount:'12.00',total:'10.00',change:'10.00'}});
 expect((await post()).replayed).toBe(true);await expect(post({...checkout,couponCode:'CHANGED'})).rejects.toMatchObject({code:'PT409',message:'IDEMPOTENCY_CONFLICT'});
 expect((await rpc(owner,'select list_coupons(1)')).items[0].usedCount).toBe(1);
 await expect(rpc(staff,'select quote_coupon_sale($1,$2,$3)',[JSON.stringify(cart),'0.00','SAVE10'])).rejects.toMatchObject({code:'PT409'});
 const report=()=>rpc(account,"select coupon_usage_report(now()-interval '1 day',now()+interval '1 day',1)");
 expect(await report()).toMatchObject({total:1,summary:{uses:1,discount:'10.00'}});await expect(rpc(staff,"select coupon_usage_report(now()-interval '1 day',now()+interval '1 day',1)")).rejects.toMatchObject({code:'PT403'});
 await rpc(owner,'select void_sale($1,$2,$3)',[sale.saleId,'Test void',req]);await rpc(owner,'select void_sale($1,$2,$3)',[sale.saleId,'Test void',req]);
 expect((await rpc(owner,'select list_coupons(1)')).items[0].usedCount).toBe(0);expect(await report()).toMatchObject({total:1,summary:{uses:0,discount:'0.00'}});
 expect((await db.query<any>("select count(*)::int n from coupon_events where action='REVERSE'")).rows[0].n).toBe(1);

 // Receipt offers are immutable snapshots; hidden, expired, future and exhausted coupons cannot leak or redeem.
 const more=await manage(owner,'CREATE',null,{...input,code:'CAP',amount:'99.00',maxUses:3});
 await manage(owner,'CREATE',null,{...input,code:'HIDDEN',showOnReceipt:false,maxUses:3});
 await manage(owner,'CREATE',null,{...input,code:'EXPIRED',startsOn:'2000-01-01',endsOn:'2000-01-02'});
 await manage(owner,'CREATE',null,{...input,code:'FUTURE',startsOn:'2099-01-01',endsOn:'2099-01-02'});
 for(const code of ['EXPIRED','FUTURE'])await expect(rpc(staff,'select quote_coupon_sale($1,$2,$3)',[JSON.stringify(cart),'0.00',code])).rejects.toMatchObject({code:'PT409'});
 const capped=await rpc(staff,'select quote_coupon_sale($1,$2,$3)',[JSON.stringify(cart),'2.00','CAP']);expect(capped).toMatchObject({totalAmount:'0.00',discountAmount:'22.00',couponDiscountAmount:'20.00'});
 const fresh=(await db.query<any>('select row_version::int v from products where id=$1',[product.id])).rows[0].v;
 const second=await post({...checkout,items:[{...checkout.items[0]!,expectedVersion:fresh}],couponCode:'CAP',expectedTotalAmount:'0.00'},'10000000-0000-4000-8000-000000000002');
 expect(second.receipt.couponOffers.map((v:any)=>v.code)).toEqual(['CAP','SAVE10']);
 expect(second.receipt.couponOffers.find((v:any)=>v.code==='CAP').amount).toBe('99.00');
 const live=(await rpc(owner,'select list_coupons(1)')).items.find((v:any)=>v.id===more.id);
 await expect(manage(owner,'UPDATE',more.id,{...input,code:'CAP',version:1})).rejects.toMatchObject({code:'PT409'});
 await manage(owner,'DELETE',more.id,{version:live.version});
 expect((await db.query<any>('select result_json from sales where id=$1',[second.saleId])).rows[0].result_json.receipt.couponOffers).toEqual(second.receipt.couponOffers);
 await expect(rpc(staff,'select quote_coupon_sale($1,$2,$3)',[JSON.stringify(cart),'0.00','CAP'])).rejects.toMatchObject({code:'PT409'});
 // Paid Gateway completion uses the same coupon transaction, not a second discount or deduction.
 const gwInput={...checkout,items:[{...checkout.items[0]!,expectedVersion:fresh}],couponCode:'HIDDEN'};
 const hash='d'.repeat(64);await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,verified_fee,paid_at,verified_at) values($1,$2,$3,'q','1000','pay_coupon',$4,'cipher',0.15,now(),now())",[hash,org,staff,JSON.stringify(gwInput)]);
 const gw=await rpc(staff,'select complete_gateway_sale($1,$2)',[hash,req]);expect(gw.receipt).toMatchObject({paymentMethod:'PROMPTPAY',coupon:{code:'HIDDEN',amount:'10.00'},totals:{discount:'12.00',total:'10.00'}});
 expect((await rpc(staff,'select complete_gateway_sale($1,$2)',[hash,req])).replayed).toBe(true);
 expect((await db.query<any>("select used_count from coupons where code='HIDDEN'")).rows[0].used_count).toBe(1);
 await db.query("update org_modules set enabled=false where org_id=$1",[org]);await expect(rpc(staff,'select quote_coupon_sale($1,$2,$3)',[JSON.stringify(cart),'0.00','SAVE10'])).rejects.toMatchObject({code:'PT403'});await expect(report()).rejects.toMatchObject({code:'PT403'});
 expect((await as(other,()=>db.query('select * from coupons'))).rows).toEqual([]);
 await expect(as(owner,()=>db.query('update coupons set used_count=0'))).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},60000);

import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('retains purchased ownership, data, redemptions and audit while owner toggles effective module access',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003',account='00000000-0000-4000-8000-000000000004',request='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 const rpc=async(uid:string,sql:string,args:unknown[]=[])=> (await as(uid,sql+' as result',args)).rows[0].result;
 const toggle=(uid:string,enabled:boolean)=>rpc(uid,'select set_org_module_enabled($1,$2,$3)',['coupons',enabled,request]);
 try{
  await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const n of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'));
  for(const id of [owner,other,staff,account])await db.query('insert into auth.users values($1,now())',[id]);
  const org=(await rpc(owner,"select bootstrap_org('Shop','Owner',$1)",[request])).orgId;await rpc(other,"select bootstrap_org('Other','Other',$1)",[request]);
  for(const [id,role] of [[staff,'EMPLOYEE'],[account,'ACCOUNTANT']])await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Member',$3)",[org,id,role]);
  await expect(toggle(owner,true)).rejects.toMatchObject({code:'PT409',message:'MODULE_NOT_PURCHASED'});
  await rpc(owner,'select demo_purchase_coupons($1)',[request]);
  const original=(await db.query<Record<string,unknown>>('select * from org_modules where org_id=$1',[org])).rows[0];
  const day=(await db.query<any>("select (now() at time zone 'Asia/Bangkok')::date::text d")).rows[0].d;
  const coupon=await rpc(owner,'select manage_coupon($1,null,$2,$3)',['CREATE',JSON.stringify({name:'Discount',code:'SAVE10',amount:'10.00',startsOn:day,endsOn:day,maxUses:3,showOnReceipt:true}),request]);
  const product=await rpc(owner,"select create_product_with_stock('create',null,'ACT001','Coffee',null,20,5,null,$1,20)",[request]);
  const cart=JSON.stringify([{productId:product.id,quantity:1}]);
  const checkout={items:[{productId:product.id,quantity:1,expectedUnitPrice:'20.00',expectedVersion:2}],discountAmount:'0.00',couponCode:'SAVE10',expectedTotalAmount:'10.00',payment:{method:'CASH',receivedAmount:'20.00'}};
  const post=()=>rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[JSON.stringify(checkout),request,request,'cipher']);
  const sale=await post();expect(sale.receipt.coupon.code).toBe('SAVE10');
  expect(await toggle(owner,false)).toEqual({coupons:false,purchased:{coupons:true}});await toggle(owner,false);
  for(const uid of [staff,account])await expect(toggle(uid,true)).rejects.toMatchObject({code:'PT403'});
  await expect(toggle(other,true)).rejects.toMatchObject({code:'PT409'});
  await expect(as(owner,'update org_modules set enabled=true where org_id=$1',[org])).rejects.toMatchObject({code:'42501'});
  await expect(rpc(staff,'select quote_coupon_sale($1,$2,$3)',[cart,'0.00','SAVE10'])).rejects.toMatchObject({code:'PT403',message:'MODULE_NOT_ACTIVE'});
  await expect(rpc(owner,'select list_coupons(1)')).rejects.toMatchObject({code:'PT403'});
  await expect(rpc(account,"select coupon_usage_report(now()-interval '1 day',now()+interval '1 day',1)")).rejects.toMatchObject({code:'PT403'});
  expect((await as(owner,'select * from coupons')).rows).toEqual([]);
  await expect(rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[JSON.stringify(checkout),'10000000-0000-4000-8000-000000000002',request,'cipher'])).rejects.toMatchObject({code:'PT403',message:'MODULE_NOT_ACTIVE'});
  const freshVersion=(await db.query<any>('select row_version::int v from products where id=$1',[product.id])).rows[0].v;
  const regular={...checkout,items:[{...checkout.items[0],expectedVersion:freshVersion}],expectedTotalAmount:'20.00',payment:{method:'CASH',receivedAmount:'20.00'}} as typeof checkout & {couponCode?:string};delete (regular as Partial<typeof checkout>).couponCode;
  const normalSale=await rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[JSON.stringify(regular),'10000000-0000-4000-8000-000000000003',request,'cipher']);expect(normalSale.receipt.couponOffers??[]).toEqual([]);expect(normalSale.totalAmount).toBe('20.00');
  expect((await post()).replayed).toBe(true); // recovery of committed sale remains valid while disabled
  await rpc(owner,'select demo_purchase_coupons($1)',[request]);expect((await db.query<any>('select enabled from org_modules where org_id=$1',[org])).rows[0].enabled).toBe(false);
  await db.exec("alter table activity_logs add constraint fail_module_activation check(action<>'MODULE_COUPONS_ENABLED') not valid");
  await expect(toggle(owner,true)).rejects.toThrow();expect((await db.query<any>('select enabled from org_modules where org_id=$1',[org])).rows[0].enabled).toBe(false);await db.exec('alter table activity_logs drop constraint fail_module_activation');
  expect(await toggle(owner,true)).toEqual({coupons:true,purchased:{coupons:true}});await toggle(owner,true);
  const enabled=(await db.query<Record<string,unknown>>('select * from org_modules where org_id=$1',[org])).rows[0];expect(enabled).toEqual({...original,enabled:true});
  expect((await rpc(owner,'select list_coupons(1)')).items[0]).toMatchObject({id:coupon.id,usedCount:1,maxUses:3});
  expect(await rpc(account,"select coupon_usage_report(now()-interval '1 day',now()+interval '1 day',1)")).toMatchObject({total:1,summary:{uses:1,discount:'10.00'}});
  const actions=(await db.query<any>("select action,count(*)::int n from activity_logs where action like 'MODULE_%' group by action")).rows;
  expect(actions).toEqual(expect.arrayContaining([{action:'MODULE_DEMO_PURCHASED',n:1},{action:'MODULE_COUPONS_DISABLED',n:1},{action:'MODULE_COUPONS_ENABLED',n:1}]));
  await toggle(owner,false);await rpc(owner,'select void_sale($1,$2,$3)',[sale.saleId,'Void while module disabled',request]);await toggle(owner,true);expect((await rpc(owner,'select list_coupons(1)')).items[0].usedCount).toBe(0);
 }finally{await db.close();}
},60000);

import {it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';import {readFileSync,readdirSync} from 'node:fs';
import request from 'supertest';import {createApp} from '../apps/api/src/app';import {productInput} from '../apps/api/src/modules/products/schema';
import {addToCart,changeQuantity,cartSchema} from '../apps/web/src/features/pos/cart';import {applyCafeLine} from '../apps/web/src/features/cafe-options/cart-lines';
const id=(n:number)=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
it('permits explicit cafe stock opt-out, atomically preserves stock and voids only actual movements',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner=id(1),staff=id(2),other=id(3),retail=id(4),req=id(5);
 const rpc=async(uid:string,sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const result=(await db.query<any>(sql+' as result',args)).rows[0]?.result;await db.exec('commit');return result;}catch(e){await db.exec('rollback');throw e;}};
 const save=(uid:string,p:any,track:boolean,qty=0)=>rpc(uid,'select manage_cafe_stock_product($1,$2,$3,$4,null,10,2,$5,$6,$7,$8,$9,$10)',[p?'update':'create',p?.id??null,p?.barcode??id(++seq),'Coffee',p?.version??null,req,qty,[],[],track]);let seq=10;
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 for(const uid of [owner,staff,other,retail])await db.query('insert into auth.users values($1,now())',[uid]);
 const org=(await rpc(owner,"select bootstrap_org_with_mode('Cafe','Owner',$1,'cipher','CAFE')",[req])).orgId;await rpc(other,"select bootstrap_org_with_mode('Other','Owner',$1,'cipher','CAFE')",[req]);await rpc(retail,"select bootstrap_org_with_mode('Retail','Owner',$1,'cipher','RETAIL')",[req]);await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,staff]);
 await expect(save(staff,null,false)).rejects.toMatchObject({code:'PT403'});await expect(save(retail,null,false)).rejects.toMatchObject({message:'CAFE_MODE_REQUIRED'});await expect(save(owner,null,false,2)).rejects.toMatchObject({code:'PT400'});
 const unlimited=await save(owner,null,false),tracked=await save(owner,null,true,3);expect(unlimited).toMatchObject({trackStock:false,quantity:0});expect(tracked).toMatchObject({trackStock:true,quantity:3});await expect(save(other,unlimited,false)).rejects.toMatchObject({code:'PT404'});
 const catalog=await rpc(staff,'select list_pos_products()');expect(catalog.items.find((p:any)=>p.id===unlimited.id).trackStock).toBe(false);
 const summary=await rpc(owner,'select dashboard_summary(false)');expect(summary.lowStockCount).toBe(1);
 const lowStock=await rpc(owner,"select report_data('low-stock',now()-interval '1 day',now()+interval '1 day')");expect(lowStock.items.map((p:any)=>p.id)).toEqual([tracked.id]);
 const quote=(items:unknown)=>rpc(staff,"select quote_coupon_sale($1,'0.00',null)",[items]);
 const lines=[{productId:unlimited.id,quantity:20},{productId:tracked.id,quantity:2}];const q=await quote(lines);expect(q.totalAmount).toBe('220.00');await expect(quote([{productId:tracked.id,quantity:4}])).rejects.toMatchObject({message:'INSUFFICIENT_STOCK'});
 const input={items:q.items.map((x:any)=>({productId:x.productId,lineId:x.lineId,quantity:x.quantity,expectedVersion:x.expectedVersion,expectedUnitPrice:x.unitPrice,expectedOptionsFingerprint:x.optionsFingerprint})),discountAmount:'0.00',expectedTotalAmount:q.totalAmount,payment:{method:'CASH',receivedAmount:'250.00'}};
 const post=(key=id(40))=>rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[input,key,req,'cipher']);const sale=await post();expect(sale.changeAmount).toBe('30.00');expect((await post()).replayed).toBe(true);
 const quantities=async()=> (await db.query<any>('select id,quantity_on_hand as q from products where org_id=$1 order by id',[org])).rows;
 expect(await quantities()).toEqual(expect.arrayContaining([{id:unlimited.id,q:0},{id:tracked.id,q:1}]));
 expect((await db.query<any>('select product_id from stock_movements where sale_id=$1',[sale.saleId])).rows).toEqual([{product_id:tracked.id}]);
 // Toggle policies after the sale: reversals use immutable movements, not current policy.
 const latest=(await db.query<any>('select row_version as version from products where id=$1',[tracked.id])).rows[0];await save(owner,{...tracked,...latest},false);await save(owner,unlimited,true);
 await rpc(owner,"select void_sale($1,'cancel',$2)",[sale.saleId,req]);await rpc(owner,"select void_sale($1,'cancel',$2)",[sale.saleId,req]);expect(await quantities()).toEqual(expect.arrayContaining([{id:unlimited.id,q:0},{id:tracked.id,q:3}]));
 // A stale product version cannot change policy or assignments.
 await expect(save(owner,unlimited,false)).rejects.toMatchObject({message:'PRODUCT_VERSION_CONFLICT'});
 // A failed policy audit rolls the entire metadata/policy transaction back.
 const beforeFailure=(await db.query<any>('select private.product_json(p) as p from products p where id=$1',[unlimited.id])).rows[0]!.p;
 await db.exec("alter table activity_logs add constraint fail_cafe_policy check(action<>'CAFE_STOCK_POLICY_SAVED') not valid");
 await expect(save(owner,beforeFailure,false)).rejects.toMatchObject({code:'23514'});await db.exec('alter table activity_logs drop constraint fail_cafe_policy');
 expect((await db.query<any>('select private.product_json(p) as p from products p where id=$1',[unlimited.id])).rows[0]!.p).toEqual(beforeFailure);
 // Paid cafe Gateway snapshots also complete after switching the shop back to retail.
 const gatewayQuote=await quote([{productId:tracked.id,quantity:10}]);const gatewayInput={items:gatewayQuote.items.map((x:any)=>({productId:x.productId,lineId:x.lineId,quantity:x.quantity,optionIds:x.optionIds,note:x.note,expectedVersion:x.expectedVersion,expectedUnitPrice:x.unitPrice,expectedOptionsFingerprint:x.optionsFingerprint,cafeSnapshot:x.cafeSnapshot})),discountAmount:'0.00',expectedTotalAmount:gatewayQuote.totalAmount,payment:{method:'CASH',receivedAmount:gatewayQuote.totalAmount}};
 const hash='c'.repeat(64);await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,paid_at,verified_at,verified_fee) values($1,$2,$3,'q','10000','pay_no_stock',$4,'cipher',now(),now(),1.50)",[hash,org,staff,gatewayInput]);
 // Returning the shop to retail enforces ordinary stock limits for every product.
 await db.query("update store_settings set store_mode='RETAIL' where org_id=$1",[org]);expect((await rpc(staff,'select list_pos_products()')).items.every((p:any)=>p.trackStock!==false)).toBe(true);
 const paid=await rpc(staff,'select complete_gateway_sale($1,$2)',[hash,req]);expect(paid.totalAmount).toBe('100.00');expect((await db.query<any>('select count(*)::int n from stock_movements where sale_id=$1',[paid.saleId])).rows[0]!.n).toBe(0);expect(await quantities()).toEqual(expect.arrayContaining([{id:tracked.id,q:3}]));
 await expect(rpc(staff,"select quote_cash_sale($1,'0.00')",[[{productId:unlimited.id,quantity:1}]])).rejects.toMatchObject({message:'INSUFFICIENT_STOCK'});
 expect((await db.query<any>("select count(*)::int n from activity_logs where org_id=$1 and action='CAFE_STOCK_POLICY_SAVED'",[org])).rows[0]!.n).toBe(3);
 await db.exec('set role anon');await expect(db.query("select manage_cafe_stock_product('create',null,'x','x',null,1,0,null,$1,0,'{}','[]',false)",[req])).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);
it('shares zero-stock cafe behavior across click, scan, variant edits and persisted carts; old products remain bounded',()=>{
 const product={id:id(1),name:'Coffee',barcode:'001',salePrice:'10.00',quantityOnHand:0,trackStock:false,rowVersion:1,categoryId:null,imageUrl:null};
 let cart=addToCart([],product);cart=addToCart(cart,product);expect(cart[0]!.quantity).toBe(2);expect(changeQuantity(cart,id(1),1)[0]!.quantity).toBe(3);expect(cartSchema.parse(cart)[0]!.trackStock).toBe(false);
 const variants=applyCafeLine([],product,[],'no ice',50);expect(variants[0]!.quantity).toBe(50);expect(applyCafeLine(variants,product,[],'no ice',50)[0]!.quantity).toBe(100);
 expect(addToCart([],{...product,trackStock:undefined})).toEqual([]);expect(()=>applyCafeLine([],{...product,trackStock:true},[],'',1)).toThrow('สต็อก');
 const bounded={...product,trackStock:true,quantityOnHand:2};const two=applyCafeLine(applyCafeLine([],bounded,[],'a'),bounded,[],'b');expect(changeQuantity(two,two[0]!.lineId!,1)).toEqual(two);
 expect(()=>applyCafeLine([],product,[],'',2147483648)).toThrow();
});
it('forwards the optional policy only inside cafe options without altering legacy product payloads',async()=>{
 const context={userId:id(1),orgId:id(2),orgName:'Cafe',username:'Owner',role:'OWNER' as const,permissions:[]};const mutate=vi.fn(async(...args:unknown[])=>({id:id(3),barcode:'x',name:'Coffee',categoryId:null,salePrice:'10.00',unitCost:'2.00',quantity:0,version:1,imagePath:null}));const app=createApp({allowedOrigins:[],log:()=>{},resolveIdentity:async()=>context,products:{list:vi.fn(),mutate}});
 const body={barcode:'x',name:'Coffee',categoryId:null,salePrice:'10',unitCost:'2',cafeOptions:{trackStock:false,groupIds:[],versions:[]}};
 expect(productInput.safeParse(body).success).toBe(true);expect(productInput.safeParse({...body,cafeOptions:{...body.cafeOptions,trackStock:'false'}}).success).toBe(false);
 expect((await request(app).post('/api/v1/inventory/products').set('Authorization','Bearer fixture').send(body)).status).toBe(200);expect(mutate.mock.calls[0]![3]).toMatchObject({cafeOptions:{trackStock:false}});
});

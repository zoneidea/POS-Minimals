import {it,expect} from 'vitest';import {PGlite} from '@electric-sql/pglite';import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';import {readFileSync,readdirSync} from 'node:fs';
it('validates cafe choices, snapshots prices, aggregates stock, protects payments and reverses coupons exactly once',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003',request='10000000-0000-4000-8000-000000000001';
 const as=async(uid:string,sql:string,args:unknown[]=[])=>{await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);try{const r=await db.query<any>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}};
 const rpc=async(uid:string,sql:string,args:unknown[]=[])=> (await as(uid,sql+' as result',args)).rows[0].result;
 const id=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const n of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'));
 for(const uid of [owner,other,staff])await db.query('insert into auth.users values($1,now())',[uid]);
 const org=(await rpc(owner,"select bootstrap_org_with_mode('Cafe','Owner',$1,'cipher','CAFE')",[request])).orgId;await rpc(other,"select bootstrap_org_with_mode('Other','Owner',$1,'cipher','CAFE')",[request]);await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff','EMPLOYEE')",[org,staff]);
 const product=await rpc(owner,"select create_product_with_stock('create',null,'LATTE','Latte',null,45,10,null,$1,50)",[request]);
 const foreign=await rpc(other,"select create_product_with_stock('create',null,'OTHER','Other',null,10,1,null,$1,20)",[request]);
 const sweet={name:'Sweetness',minChoices:1,maxChoices:1,enabled:true,productIds:[product.id],options:[{id:id(1),name:'Less sweet',price:'0.00',enabled:true,isDefault:true},{id:id(2),name:'No sugar',price:'0.00',enabled:true,isDefault:false}]};
 const topping={name:'Toppings',minChoices:0,maxChoices:2,enabled:true,productIds:[product.id],options:[{id:id(3),name:'Extra shot',price:'15.00',enabled:true,isDefault:false},{id:id(4),name:'Milk',price:'10.00',enabled:true,isDefault:false}]};
 const save=(uid:string,gid:string|null,input:unknown,version:number|null)=>rpc(uid,'select save_cafe_option_group($1,$2,$3,$4)',[gid,input,version,request]);
 await expect(save(staff,null,sweet,null)).rejects.toMatchObject({code:'PT403'});await expect(save(owner,null,{...sweet,productIds:[foreign.id]},null)).rejects.toMatchObject({code:'PT400'});
 const sg=await save(owner,null,sweet,null),tg=await save(owner,null,topping,null);expect((await rpc(staff,'select cafe_option_configuration(false)')).groups).toHaveLength(2);expect((await rpc(other,'select cafe_option_configuration(true)')).groups).toHaveLength(0);
 await expect(rpc(staff,'select cafe_option_configuration(true)')).rejects.toMatchObject({code:'PT403'});expect((await as(staff,'select * from cafe_options')).rows).toEqual([]);
 await expect(save(other,sg.id,sweet,1)).rejects.toMatchObject({code:'PT400'});
 await expect(as(owner,'update cafe_options set price=0')).rejects.toMatchObject({code:'42501'});
 await expect(rpc(staff,'select private.quote_cafe_options($1,$2,null,true)',[[],'0.00'])).rejects.toMatchObject({code:'42501'});
 const lines=[{productId:product.id,lineId:id(11),quantity:2,optionIds:[id(1),id(3)],note:'  separate ice <script>  '},{productId:product.id,lineId:id(12),quantity:1,optionIds:[id(2),id(4)],note:''}];
 const quote=(items:unknown,discount='0.00',coupon:string|null=null)=>rpc(staff,'select quote_coupon_sale($1,$2,$3)',[items,discount,coupon]);
 await expect(quote([{productId:product.id,quantity:1}])).rejects.toMatchObject({code:'PT409',message:'OPTION_SELECTION_REQUIRED'});
 await expect(quote([{...lines[0],quantity:49},lines[1]])).resolves.toBeDefined();await expect(quote([{...lines[0],quantity:50},lines[1]])).rejects.toMatchObject({code:'PT409',message:'INSUFFICIENT_STOCK'});
 await expect(quote([{...lines[0],optionIds:[id(1),id(2)]}])).rejects.toMatchObject({code:'PT409'});await expect(quote([{...lines[0],optionIds:[id(1),id(99)]}])).rejects.toMatchObject({code:'PT409'});
 await expect(quote([{...lines[0],optionIds:[id(1),id(1)]}])).rejects.toMatchObject({code:'PT400'});await expect(quote([{...lines[0],note:'x'.repeat(201)}])).rejects.toMatchObject({code:'PT400'});
 const q=await quote(lines);expect(q.subtotalAmount).toBe('175.00');expect(q.items.map((i:any)=>i.unitPrice)).toEqual(['60.00','55.00']);expect(q.items[0].note).toBe('separate ice <script>');
 // Bind a gateway quote before editing a topping. Only the server-created immutable snapshot may use captured prices.
 const one=await quote([{...lines[0],quantity:1}]);
 const gatewayInput={items:one.items.map((i:any)=>({productId:i.productId,lineId:i.lineId,optionIds:i.optionIds,note:i.note,quantity:i.quantity,expectedUnitPrice:i.unitPrice,expectedVersion:i.expectedVersion,expectedOptionsFingerprint:i.optionsFingerprint,cafeSnapshot:i.cafeSnapshot})),discountAmount:'0.00',expectedTotalAmount:one.totalAmount,payment:{method:'CASH',receivedAmount:one.totalAmount}};
 const hash='b'.repeat(64);await db.query("insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor,payment_id,checkout_input,identity_cipher,paid_at,verified_at,verified_fee) values($1,$2,$3,'q','6000','pay_options',$4,'cipher',now(),now(),0.90)",[hash,org,staff,gatewayInput]);
 await rpc(owner,'select demo_purchase_coupons($1)',[request]);const day=(await db.query<any>("select (now() at time zone 'Asia/Bangkok')::date::text d")).rows[0].d;
 await rpc(owner,'select manage_coupon($1,null,$2,$3)',['CREATE',{name:'Save',code:'SAVE10',amount:'10.00',startsOn:day,endsOn:day,maxUses:3,showOnReceipt:true},request]);await db.query('update store_settings set vat_enabled=true,vat_rate=7 where org_id=$1',[org]);
 const cq=await quote(lines,'5.00','SAVE10');expect(cq).toMatchObject({subtotalAmount:'175.00',discountAmount:'15.00',totalAmount:'160.00',vatAmount:'10.47'});
 const input={items:cq.items.map((i:any)=>({productId:i.productId,lineId:i.lineId,optionIds:i.optionIds,note:i.note,quantity:i.quantity,expectedUnitPrice:i.unitPrice,expectedVersion:i.expectedVersion,expectedOptionsFingerprint:i.optionsFingerprint})),discountAmount:'5.00',couponCode:'SAVE10',expectedTotalAmount:'160.00',payment:{method:'CASH',receivedAmount:'200.00'}};
 const post=(v:unknown,key=id(21))=>rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[v,key,request,'cipher']);
 const sale=await post(input);expect(sale.changeAmount).toBe('40.00');expect(sale.receipt.items).toHaveLength(2);expect(sale.receipt.items[0].options).toContainEqual(expect.objectContaining({name:'Extra shot',price:'15.00'}));expect(sale.receipt.items[0].note).toBe('separate ice <script>');expect(sale.receipt.cafe.queueNo).toBe('A001');
 expect((await post(input)).replayed).toBe(true);await expect(post({...input,items:[{...input.items[0],note:'changed'},input.items[1]]})).rejects.toMatchObject({code:'PT409',message:'IDEMPOTENCY_CONFLICT'});
 expect((await db.query<any>('select quantity_on_hand::int q from products where id=$1',[product.id])).rows[0].q).toBe(47);expect((await db.query<any>("select count(*)::int n from stock_movements where sale_id=$1 and movement_type='SALE_OUT'",[sale.saleId])).rows[0].n).toBe(1);
 expect((await db.query<any>('select sum(line_total)::text total from sale_items where sale_id=$1',[sale.saleId])).rows[0].total).toBe('160.00');
 const updated=await save(owner,tg.id,{...topping,options:topping.options.map(o=>({...o,price:'25.00',enabled:false}))},1);expect(updated.version).toBe(2);await expect(save(owner,tg.id,topping,1)).rejects.toMatchObject({code:'PT409'});
 const paid=await rpc(staff,'select complete_gateway_sale($1,$2)',[hash,request]);expect(paid.totalAmount).toBe('60.00');expect(paid.receipt.items[0].options.some((o:any)=>o.name==='Extra shot'&&o.price==='15.00')).toBe(true);expect((await rpc(staff,'select complete_gateway_sale($1,$2)',[hash,request])).replayed).toBe(true);
 await expect(post({...gatewayInput,items:gatewayInput.items.map((i:any)=>({...i,expectedVersion:4}))},id(22))).rejects.toMatchObject({code:'PT400'});
 const historical=(await db.query<any>('select result_json from sales where id=$1',[sale.saleId])).rows[0].result_json;expect(historical.receipt.items[0].options).toContainEqual(expect.objectContaining({name:'Extra shot',price:'15.00'}));
 const voided=await rpc(owner,"select void_sale($1,'Cancel cafe',$2)",[sale.saleId,request]);expect(voided.status).toBe('VOIDED');await rpc(owner,"select void_sale($1,'Cancel cafe',$2)",[sale.saleId,request]);expect((await db.query<any>('select quantity_on_hand::int q from products where id=$1',[product.id])).rows[0].q).toBe(49);expect((await db.query<any>('select used_count::int n from coupons where org_id=$1',[org])).rows[0].n).toBe(0);
 await db.exec('set role anon');await expect(db.query('select cafe_option_configuration(false)')).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);

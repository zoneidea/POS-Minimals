import {expect,it,vi} from 'vitest';import request from 'supertest';import {createApp} from '../apps/api/src/app';import type {UserContext} from '../apps/api/src/modules/auth/types';
const id='00000000-0000-4000-8000-000000000001';const group={name:'Toppings',minChoices:0,maxChoices:1,enabled:true,productIds:[],options:[{id,name:'Shot',price:'15.00',enabled:true,isDefault:false}]};
function setup(role:UserContext['role']='OWNER'){const service={read:vi.fn().mockResolvedValue({storeMode:'CAFE',groups:[]}),save:vi.fn().mockResolvedValue({id,version:1})},checkout={commit:vi.fn().mockResolvedValue({saleId:id}),recover:vi.fn()};const app=createApp({allowedOrigins:[],log:()=>{},resolveIdentity:async()=>({userId:id,orgId:id,orgName:'Cafe',username:'Owner',permissions:[],role}),cafeOptions:service,checkout});return {app,service,checkout};}
it('keeps owner-only configuration, authenticated catalog and strict tenant-safe validation',async()=>{const {app,service}=setup();expect((await request(app).get('/api/v1/cafe/options')).status).toBe(401);expect((await request(app).get('/api/v1/management/cafe/options').set('Authorization','Bearer jwt')).status).toBe(200);expect(service.read).toHaveBeenCalledWith('jwt',true);
 for(const body of [{...group,orgId:id},{...group,minChoices:2},{...group,options:[{...group.options[0],price:'-1.00'}]}])expect((await request(app).post('/api/v1/management/cafe/option-groups').set('Authorization','Bearer jwt').send(body)).status).toBe(400);
 expect((await request(app).post('/api/v1/management/cafe/option-groups').set('Authorization','Bearer jwt').send(group)).status).toBe(200);expect(service.save).toHaveBeenCalledWith('jwt',null,group,null,expect.any(String));
 for(const role of ['EMPLOYEE','ACCOUNTANT'] as const){const v=setup(role);expect((await request(v.app).get('/api/v1/cafe/options').set('Authorization','Bearer jwt')).status).toBe(200);expect((await request(v.app).post('/api/v1/management/cafe/option-groups').set('Authorization','Bearer jwt').send(group)).status).toBe(403);expect(v.service.save).not.toHaveBeenCalled();}
});
it('accepts optional cafe line fields while rejecting duplicate identities, long notes and forged server snapshots',async()=>{const {app,checkout}=setup('EMPLOYEE');const item={productId:id,lineId:id,optionIds:[id],note:'ice',quantity:1,expectedUnitPrice:'60.00',expectedVersion:1,expectedOptionsFingerprint:'a'.repeat(32)},input={items:[item],discountAmount:'0.00',expectedTotalAmount:'60.00',payment:{method:'CASH',receivedAmount:'100.00'}};
 const post=(body:object)=>request(app).post('/api/v1/sales').set('Authorization','Bearer jwt').set('Idempotency-Key',id).send(body);
 expect((await post(input)).status).toBe(201);expect(checkout.commit).toHaveBeenCalledOnce();for(const items of [[item,item],[{...item,note:'x'.repeat(201)}],[{...item,cafeSnapshot:{baseUnitPrice:'0.00'}}]])expect((await post({...input,items})).status).toBe(400);
});

it('binds Gateway cafe pricing to the server quote rather than caller-provided option metadata',async()=>{
 const {createGatewayService}=await import('../apps/api/src/modules/payments/gateway');
 const context={orgId:id,userId:id,role:'EMPLOYEE' as const,orgName:'Cafe',username:'Staff',permissions:[]};
 const snapshot={baseUnitPrice:'45.00',options:[{id,name:'Shot',groupName:'Toppings',price:'15.00'}],configuration:[{id,version:2}]};
 const ledger={bind:vi.fn(async()=>{}),prepare:vi.fn(async()=>{}),recordPayment:vi.fn(async()=>{})};
 const row={productId:id,lineId:id,quantity:1,unitPrice:'60.00',expectedVersion:1,optionIds:[id],note:'ice',optionsFingerprint:'a'.repeat(32),cafeSnapshot:snapshot};
 const service=createGatewayService({apiKey:'test-only',encryptionKey:'11'.repeat(32),returnUrl:'https://example.test/',ledger,quote:async()=>({totalAmount:'60.00',items:[row]} as any),settings:{get:async()=>({mode:'GATEWAY'})} as any,send:async(url)=>new Response(String(url).includes('/sdk/')?JSON.stringify({amount:6000,currency:'THB',payment_method:'PROMPTPAY'}):'"pay_cafe_test"')});
 await service('jwt',context,{sessionId:'ps_test123',items:[{productId:id,lineId:id,optionIds:[id],note:'ice',quantity:1}],discountAmount:'0.00',expectedTotalAmount:'60.00'});
 expect(ledger.prepare).toHaveBeenCalledWith(expect.any(String),context,expect.objectContaining({items:[{productId:id,lineId:id,quantity:1,expectedUnitPrice:'60.00',expectedVersion:1,optionIds:[id],note:'ice',expectedOptionsFingerprint:'a'.repeat(32),cafeSnapshot:snapshot}]}),expect.any(String));
});

import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {parse} from 'yaml';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import {createApp} from '../apps/api/src/app';
import {ApiError} from '../apps/api/src/infra/errors';
import {quoteResult} from '../apps/api/src/modules/sales/quote';
const id='00000000-0000-4000-8000-000000000001';
const identity=(token:string)=>({userId:id,orgId:token==='shop-b'?'00000000-0000-4000-8000-000000000002':id,orgName:'Shop',username:'Staff',role:'EMPLOYEE' as const,permissions:[]});
it('preserves legacy config and publishes a credential-free typed opt-in integration profile',async()=>{
 const resolve=vi.fn(async(token:string)=>identity(token)),app=createApp({resolveIdentity:resolve,allowedOrigins:[],log:()=>{}});
 const old=await request(app).get('/api/v1/client/config');expect(old.body.data).toEqual({apiVersion:'v1',minimumWebVersion:'1.0.0',receiptSchemaVersion:1});
 const res=await request(app).get('/api/v1/client/config?profile=integration');expect(res.status).toBe(200);expect(resolve).not.toHaveBeenCalled();
 expect(res.body.data.integration).toMatchObject({moneyEncoding:'decimal-string',businessTimeZone:'Asia/Bangkok',offlineCheckout:false,nativePaymentGatewayReady:false,modulePurchaseMode:'DEMO'});
 const spec=parse(readFileSync('contracts/openapi.yaml','utf8')),valid=new Ajv2020({strict:false}).compile(spec.components.schemas.ClientConfig);
 expect(valid(res.body.data),JSON.stringify(valid.errors)).toBe(true);expect(valid(old.body.data)).toBe(true);
 expect(res.headers['cache-control']).toBe('no-store');expect(res.headers['x-request-id']).toBeTruthy();
 expect(JSON.stringify(res.body)).not.toMatch(/api[_-]?key|password|service.role|refresh.token|supabase\.co/i);
 for(const path of ['?profile=unknown','?profile=integration&orgId='+id,'?profile=integration&profile=integration'])expect((await request(app).get('/api/v1/client/config'+path)).status).toBe(400);
});
it('native HTTP needs a valid bearer, keeps tenant identity and cannot gain privileges with platform headers',async()=>{
 const list=vi.fn(async()=>({items:[],total:0,page:1,limit:10}));
 const app=createApp({resolveIdentity:async token=>{if(token==='invalid')throw new ApiError(401,'UNAUTHORIZED','Invalid');return identity(token);},catalog:{list},allowedOrigins:['https://pos-minimals.vercel.app'],log:()=>{}});
 expect((await request(app).get('/api/v1/products')).status).toBe(401);
 expect((await request(app).get('/api/v1/auth/me').set('Authorization','Bearer invalid')).status).toBe(401);
 for(const token of ['shop-a','shop-b']){
 const me=await request(app).get('/api/v1/auth/me').set('Authorization','Bearer '+token).set('X-Client-Platform','IOS');expect(me.body.data.orgId).toBe(identity(token).orgId);
 const catalog=await request(app).get('/api/v1/products?barcode=001').set('Authorization','Bearer '+token).set('X-Client-Platform','OTHER');expect(catalog.status).toBe(200);
 }
 expect(list.mock.calls).toHaveLength(2);
 const forbidden=await request(app).get('/api/v1/products').set('Authorization','Bearer shop-a').set('Origin','https://untrusted.invalid');expect(forbidden.status).toBe(403);
 const forged=await request(app).get('/api/v1/products?orgId='+id).set('Authorization','Bearer shop-a');expect(forged.status).toBe(400);
 // Metadata headers do not turn an employee into an owner or accountant.
 const reports={report:vi.fn(),cashiers:vi.fn(),dashboard:vi.fn(),rankings:vi.fn()};
 const guarded=createApp({resolveIdentity:async token=>identity(token),reports,allowedOrigins:[],log:()=>{}});
 expect((await request(guarded).get('/api/v1/reports/sales').set('Authorization','Bearer shop-a').set('X-Client-Platform','WEB').set('X-Client-Version','999.0.0')).status).toBe(403);expect(reports.report).not.toHaveBeenCalled();
});
it('provides React Native discovery without changing legacy/integration output or requiring staff auth',async()=>{
 const guard=vi.fn(),resolve=vi.fn(),app=createApp({checkSessionDay:guard,resolveIdentity:resolve,allowedOrigins:[],log:()=>{}});
 const res=await request(app).get('/api/v1/client/config?profile=react-native');expect(res.status).toBe(200);
 expect(guard).not.toHaveBeenCalled();expect(resolve).not.toHaveBeenCalled();
 expect(res.body.data.reactNative).toEqual({framework:'react-native',applicationReleased:false,tokenStorage:'OS_SECURE_STORAGE',sessionExpiry:'ASIA_BANGKOK_MIDNIGHT',storeModes:['RETAIL','CAFE','RESTAURANT'],parkedBillsSync:false,printing:'PLATFORM_ADAPTER_REQUIRED',customerDisplay:'PLATFORM_ADAPTER_REQUIRED'});
 const integration=await request(app).get('/api/v1/client/config?profile=integration');expect(integration.body.data).not.toHaveProperty('reactNative');expect(res.body.data.integration).toEqual(integration.body.data.integration);
 const spec=parse(readFileSync('contracts/openapi.yaml','utf8')),valid=new Ajv2020({strict:false}).compile(spec.components.schemas.ClientConfig);expect(valid(res.body.data),JSON.stringify(valid.errors)).toBe(true);
 expect(JSON.stringify(res.body)).not.toMatch(/password|service.role|refresh.token|supabase\.co|api[_-]?key/i);
 for(const suffix of ['&orgId='+id,'&profile=integration','&role=OWNER'])expect((await request(app).get('/api/v1/client/config?profile=react-native'+suffix)).status).toBe(400);
});
it('accepts native cash quotes without Origin, validates payload and retains role/session guards',async()=>{
 const quote=vi.fn(async()=>quoteResult.parse({quoteFingerprint:'native-test',items:[{productId:id,barcode:'001',name:'Fixture item',quantity:1,unitPrice:'50.00',expectedVersion:1,lineTotal:'50.00',stockAvailable:1}],subtotalAmount:'50.00',discountAmount:'0.00',totalAmount:'50.00',vatAmount:'0.00',vatEnabled:false,vatRate:'0.00',promptpayQrPayload:null})),resolve=vi.fn(async(token:string)=>identity(token)),guard=vi.fn(async()=>Date.now()+60000);
 const app=createApp({quote,resolveIdentity:resolve,checkSessionDay:guard,allowedOrigins:[],log:()=>{}}),body={items:[{productId:id,quantity:1}],discountAmount:'0.00',paymentMethod:'CASH'};
 const response=await request(app).post('/api/v1/sales/quote').set('Authorization','Bearer shop-a').set('X-Client-Platform','ANDROID').send(body);
 expect(response.status).toBe(200);expect(quote).toHaveBeenCalledWith('shop-a',body);expect(guard).toHaveBeenCalledWith('shop-a');
 expect((await request(app).post('/api/v1/sales/quote').send(body)).status).toBe(401);
 expect((await request(app).post('/api/v1/sales/quote').set('Authorization','Bearer shop-a').send({...body,orgId:id})).status).toBe(400);
 expect(quote).toHaveBeenCalledOnce();
 const denied=createApp({quote,resolveIdentity:async()=>({...identity('shop-a'),role:'ACCOUNTANT'}),allowedOrigins:[],log:()=>{}});
 expect((await request(denied).post('/api/v1/sales/quote').set('Authorization','Bearer accountant').send(body)).status).toBe(403);
});

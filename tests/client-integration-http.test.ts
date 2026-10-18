import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {parse} from 'yaml';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import {createApp} from '../apps/api/src/app';
import {ApiError} from '../apps/api/src/infra/errors';
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

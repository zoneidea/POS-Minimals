import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {createApp} from '../apps/api/src/app';
import type {UserContext} from '../apps/api/src/modules/auth/types';
import {ApiError} from '../apps/api/src/infra/errors';
import {couponInput} from '../apps/api/src/modules/coupons/schema';
const context={userId:'00000000-0000-4000-8000-000000000001',orgId:'00000000-0000-4000-8000-000000000002',orgName:'Demo',username:'Owner',role:'OWNER',permissions:[]} as UserContext;
it('allows only owner demo purchases and coupon mutations; report is owner/accountant and validates Thai ranges',async()=>{
 const service={entitlements:vi.fn(async()=>({coupons:false})),purchase:vi.fn(async()=>({coupons:true})),list:vi.fn(async()=>({items:[],total:0,page:1,limit:10 as const})),mutate:vi.fn(),report:vi.fn(async()=>({items:[],total:0,page:1,limit:10 as const,summary:{uses:0,discount:'0.00'}}))};
 let role:UserContext['role']='OWNER';const app=createApp({resolveIdentity:async()=>({...context,role}),coupons:service,allowedOrigins:[],log:()=>{}});
 expect((await request(app).post('/api/v1/marketplace/coupons/demo-purchase').send({})).status).toBe(401);
 expect((await request(app).post('/api/v1/marketplace/coupons/demo-purchase').auth('token',{type:'bearer'}).send({orgId:context.orgId})).status).toBe(400);
 expect((await request(app).post('/api/v1/marketplace/coupons/demo-purchase').auth('token',{type:'bearer'}).send({})).status).toBe(200);
 role='EMPLOYEE';expect((await request(app).post('/api/v1/marketplace/coupons/demo-purchase').auth('token',{type:'bearer'}).send({})).status).toBe(403);expect(service.purchase).toHaveBeenCalledTimes(1);
 expect((await request(app).get('/api/v1/coupons').auth('token',{type:'bearer'})).status).toBe(403);
 expect((await request(app).get('/api/v1/reports/coupons?from=2026-10-18&to=2026-10-18').auth('token',{type:'bearer'})).status).toBe(403);
 role='ACCOUNTANT';expect((await request(app).get('/api/v1/reports/coupons?from=2026-10-18&to=2026-10-18').auth('token',{type:'bearer'})).status).toBe(200);
 expect(service.report).toHaveBeenLastCalledWith('token','2026-10-17T17:00:00.000Z','2026-10-18T17:00:00.000Z',1);
 expect((await request(app).get('/api/v1/reports/coupons?from=2026-10-19&to=2026-10-18').auth('token',{type:'bearer'})).status).toBe(400);
 role='OWNER';service.list.mockRejectedValueOnce(new ApiError(403,'MODULE_NOT_ACTIVE','module unavailable'));
 expect((await request(app).get('/api/v1/coupons').auth('token',{type:'bearer'})).status).toBe(403);
});
it('normalizes coupon codes and rejects invalid date/amount/limits',()=>{
 const input={name:'Demo',code:'save10',amount:'10.00',startsOn:'2026-10-18',endsOn:'2026-10-18',maxUses:1,showOnReceipt:true};expect(couponInput.parse(input).code).toBe('SAVE10');
 for(const patch of [{amount:'0.00'},{amount:'-1.00'},{maxUses:0},{maxUses:1.5},{startsOn:'2026-02-30'},{endsOn:'2026-10-17'},{orgId:context.orgId}])expect(couponInput.safeParse({...input,...patch}).success).toBe(false);
});

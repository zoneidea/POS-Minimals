import { expect,it,vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/api/src/app.js';
import type { Role } from '../apps/api/src/modules/auth/types.js';
const id='00000000-0000-4000-8000-000000000001',body={items:[{productId:id,quantity:2}],discountAmount:'0.00',paymentMethod:'CASH'};
function setup(role:Role='OWNER'){const quote=vi.fn().mockResolvedValue({totalAmount:'20.00'});return {quote,app:createApp({quote,resolveIdentity:async()=>({userId:id,orgId:id,orgName:'Store',username:'User',role,permissions:[]}),allowedOrigins:[],log:()=>{}})};}
it('requires authentication',async()=>{const {app,quote}=setup();expect((await request(app).post('/api/v1/sales/quote').send(body)).status).toBe(401);expect(quote).not.toHaveBeenCalled();});
it.each(['OWNER','EMPLOYEE'] as Role[])('allows %s quotes',async role=>{const {app,quote}=setup(role);expect((await request(app).post('/api/v1/sales/quote').set('Authorization','Bearer token').send(body)).status).toBe(200);expect(quote).toHaveBeenCalledWith('token',body);});
it('denies accountant and unsupported PromptPay',async()=>{const {app}=setup('ACCOUNTANT');expect((await request(app).post('/api/v1/sales/quote').set('Authorization','Bearer token').send(body)).status).toBe(403);const cash=setup();expect((await request(cash.app).post('/api/v1/sales/quote').set('Authorization','Bearer token').send({...body,paymentMethod:'PROMPTPAY'})).status).toBe(409);expect(cash.quote).not.toHaveBeenCalled();});
it.each([{...body,orgId:id},{...body,items:[]},{...body,items:[...body.items,...body.items]},{...body,discountAmount:'-1.00'},{...body,items:[{productId:id,quantity:0}]},{...body,items:[{productId:id,quantity:1,unitPrice:'0.01'}]}])('rejects unsafe quote input',async input=>{const {app,quote}=setup();expect((await request(app).post('/api/v1/sales/quote').set('Authorization','Bearer token').send(input)).status).toBe(400);expect(quote).not.toHaveBeenCalled();});

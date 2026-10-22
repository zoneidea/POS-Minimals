import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../apps/api/src/app';
import type {Role} from '../apps/api/src/modules/auth/types';
const id=randomUUID();
function setup(role:Role='OWNER'){
 const service={board:vi.fn().mockResolvedValue({tables:[]}),saveTable:vi.fn().mockResolvedValue({id}),open:vi.fn().mockResolvedValue({id}),send:vi.fn().mockResolvedValue({id}),cancelRound:vi.fn().mockResolvedValue({id}),cancelBill:vi.fn().mockResolvedValue({id}),cash:vi.fn().mockResolvedValue({saleId:id}),recover:vi.fn().mockResolvedValue({saleId:id})};
 const context={userId:id,orgId:id,orgName:'Restaurant',username:'Owner',role,permissions:[]};
 return {context,service,app:createApp({restaurant:service,resolveIdentity:async()=>context,allowedOrigins:[],log:()=>{}})};
}
it('authenticates every restaurant entry and protects management from employee/accountant',async()=>{
 for(const role of ['EMPLOYEE','ACCOUNTANT'] as Role[]){const {app,service}=setup(role);
 expect((await request(app).get('/api/v1/restaurant/board')).status).toBe(401);
 expect((await request(app).get('/api/v1/restaurant/board').set('Authorization','Bearer fixture')).status).toBe(role==='EMPLOYEE'?200:403);
 expect((await request(app).post('/api/v1/management/restaurant/tables').set('Authorization','Bearer fixture').send({name:'A1',zone:'',seats:2,enabled:true})).status).toBe(403);
 expect((await request(app).post(`/api/v1/management/restaurant/bills/${id}/rounds/${id}/cancel`).set('Authorization','Bearer fixture').send({version:1,reason:'Mistake'})).status).toBe(403);expect(service.saveTable).not.toHaveBeenCalled();expect(service.cancelRound).not.toHaveBeenCalled();}
});
it('rejects tenant, captured-price and total injection before invoking the scoped service',async()=>{
 const {app,service}=setup();const path=`/api/v1/restaurant/bills/${id}/rounds`,body={version:1,key:randomUUID(),items:[{productId:id,expectedUnitPrice:'10.00',quantity:1}]};
 for(const input of [{...body,orgId:id},{...body,items:[{productId:id,expectedUnitPrice:'10.00',quantity:1,cafeSnapshot:{baseUnitPrice:'0.00'}}]},{...body,items:[]},{...body,items:[{productId:id,quantity:0}]}])expect((await request(app).post(path).set('Authorization','Bearer fixture').send(input)).status).toBe(400);
 expect(service.send).not.toHaveBeenCalled();
 expect((await request(app).post(path).set('Authorization','Bearer fixture').send(body)).status).toBe(200);expect(service.send).toHaveBeenCalledWith('fixture',id,body,expect.any(String));
});
it('passes immutable cash request through without accepting a tenant or client receipt',async()=>{
 const {app,service,context}=setup('EMPLOYEE');const body={version:3,key:randomUUID(),receivedAmount:'100.00',totalAmount:'80.00'},path=`/api/v1/restaurant/bills/${id}/checkout/cash`;
 expect((await request(app).post(path).set('Authorization','Bearer fixture').send({...body,receipt:{}})).status).toBe(400);
 expect((await request(app).post(path).set('Authorization','Bearer fixture').send(body)).status).toBe(200);expect(service.cash).toHaveBeenCalledWith('fixture',context,id,body,expect.any(String));
 expect((await request(app).get(`/api/v1/restaurant/bills/${id}/settlement`).set('Authorization','Bearer fixture')).status).toBe(200);
});

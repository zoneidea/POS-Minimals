import { expect,it,vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/api/src/app.js';
import type { Role } from '../apps/api/src/modules/auth/types.js';
const id='00000000-0000-4000-8000-000000000001',orgId='00000000-0000-4000-8000-000000000002';
const input={barcode:'00123',name:'Coffee',categoryId:null,salePrice:'12.00',unitCost:'5.00'};
function setup(role:Role='OWNER'){
 const products={list:vi.fn().mockResolvedValue({items:[],total:0,page:1,limit:10}),mutate:vi.fn().mockResolvedValue({...input,id,quantity:0,version:1,imagePath:null})};
 return {products,app:createApp({products,resolveIdentity:async()=>({userId:id,orgId,orgName:'Store',username:'User',role,permissions:[]}),allowedOrigins:[],log:()=>{}})};
}
it('requires Bearer authentication',async()=>{const {app,products}=setup();expect((await request(app).get('/api/v1/inventory/products')).status).toBe(401);expect(products.list).not.toHaveBeenCalled();});
it.each(['EMPLOYEE','ACCOUNTANT'] as Role[])('denies cost-bearing inventory and mutations to %s',async role=>{const {app,products}=setup(role);expect((await request(app).get('/api/v1/inventory/products').set('Authorization','Bearer test')).status).toBe(403);expect((await request(app).post('/api/v1/inventory/products').set('Authorization','Bearer test').send(input)).status).toBe(403);expect(products.list).not.toHaveBeenCalled();expect(products.mutate).not.toHaveBeenCalled();});
it('lists ten rows using verified tenant',async()=>{const {app,products}=setup();expect((await request(app).get('/api/v1/inventory/products').set('Authorization','Bearer test')).status).toBe(200);expect(products.list).toHaveBeenCalledWith('test',expect.objectContaining({orgId}),1,10);});
it.each([{...input,orgId},{...input,quantity:20},{...input,salePrice:'1.234'},{...input,unitCost:'-1'},{...input,salePrice:'1e3'}])('rejects unsafe product input %j',async body=>{const {app,products}=setup();expect((await request(app).post('/api/v1/inventory/products').set('Authorization','Bearer test').send(body)).status).toBe(400);expect(products.mutate).not.toHaveBeenCalled();});
it('preserves leading zeros and trims names',async()=>{const {app,products}=setup();expect((await request(app).post('/api/v1/inventory/products').set('Authorization','Bearer test').send({...input,name:' Coffee '})).status).toBe(200);expect(products.mutate).toHaveBeenCalledWith('test','create',null,input,null,expect.any(String));});
it('requires expectedVersion for edit and delete',async()=>{const {app,products}=setup();expect((await request(app).patch(`/api/v1/inventory/products/${id}`).set('Authorization','Bearer test').send(input)).status).toBe(400);expect((await request(app).delete(`/api/v1/inventory/products/${id}`).set('Authorization','Bearer test').send({})).status).toBe(400);expect(products.mutate).not.toHaveBeenCalled();});
it('passes versioned soft-delete operation only',async()=>{const {app,products}=setup();expect((await request(app).delete(`/api/v1/inventory/products/${id}`).set('Authorization','Bearer test').send({expectedVersion:3})).status).toBe(200);expect(products.mutate).toHaveBeenCalledWith('test','delete',id,null,3,expect.any(String));});
it('rejects guessed organization query and malformed ID',async()=>{const {app}=setup();expect((await request(app).get(`/api/v1/inventory/products?orgId=${orgId}`).set('Authorization','Bearer test')).status).toBe(400);expect((await request(app).delete('/api/v1/inventory/products/bad').set('Authorization','Bearer test').send({expectedVersion:1})).status).toBe(400);});

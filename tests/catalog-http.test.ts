import { it,expect,vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/api/src/app.js';
import type { Role } from '../apps/api/src/modules/auth/types.js';
const id='00000000-0000-4000-8000-000000000001';
function setup(role:Role='EMPLOYEE'){
 const catalog={list:vi.fn().mockResolvedValue({items:[],total:0,page:1,limit:10})};
 return {catalog,app:createApp({catalog,resolveIdentity:async()=>({userId:id,orgId:id,orgName:'Store',username:'User',role,permissions:[]}),allowedOrigins:[],log:()=>{}})};
}
it('requires a Bearer token',async()=>{const {app,catalog}=setup();expect((await request(app).get('/api/v1/products')).status).toBe(401);expect(catalog.list).not.toHaveBeenCalled();});
it.each(['OWNER','EMPLOYEE'] as Role[])('allows %s to read ten catalog rows',async role=>{const {app,catalog}=setup(role);expect((await request(app).get('/api/v1/products').set('Authorization','Bearer token')).status).toBe(200);expect(catalog.list).toHaveBeenCalledWith('token',{page:1,limit:10,search:''});});
it('denies accountants',async()=>{const {app,catalog}=setup('ACCOUNTANT');expect((await request(app).get('/api/v1/products').set('Authorization','Bearer token')).status).toBe(403);expect(catalog.list).not.toHaveBeenCalled();});
it.each(['orgId=other','limit=101','page=0','categoryId=bad','search='+ 'a'.repeat(201),'barcode='])('rejects invalid or injected query %s',async query=>{const {app,catalog}=setup();expect((await request(app).get('/api/v1/products?'+query).set('Authorization','Bearer token')).status).toBe(400);expect(catalog.list).not.toHaveBeenCalled();});
it('preserves exact barcode leading zeros and trims search',async()=>{const {app,catalog}=setup();await request(app).get('/api/v1/products?barcode=00123&search=%20Coffee%20').set('Authorization','Bearer token');expect(catalog.list).toHaveBeenCalledWith('token',{page:1,limit:10,search:'Coffee',barcode:'00123'});});

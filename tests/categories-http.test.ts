import { expect,it,vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/api/src/app.js';
import type { Role } from '../apps/api/src/modules/auth/types.js';
const userId='00000000-0000-4000-8000-000000000001',orgId='00000000-0000-4000-8000-000000000002';
function setup(role:Role='OWNER'){const categories={list:vi.fn().mockResolvedValue({items:[],total:0,page:1,limit:10}),mutate:vi.fn().mockResolvedValue({id:userId,name:'Drinks',sortOrder:0})};const app=createApp({categories,resolveIdentity:async()=>({userId,orgId,orgName:'Store',username:'User',role,permissions:[]}),allowedOrigins:[],log:()=>{}});return {app,categories};}
it('requires bearer token',async()=>{const {app,categories}=setup();expect((await request(app).get('/api/v1/categories')).status).toBe(401);expect(categories.list).not.toHaveBeenCalled();});
it('validates input and rejects client organization override',async()=>{const {app,categories}=setup();expect((await request(app).post('/api/v1/categories').set('Authorization','Bearer test').send({name:'Drinks',orgId})).status).toBe(400);expect(categories.mutate).not.toHaveBeenCalled();});
it.each(['EMPLOYEE','ACCOUNTANT'] as Role[])('denies management by %s',async role=>{const {app,categories}=setup(role);expect((await request(app).post('/api/v1/categories').set('Authorization','Bearer test').send({name:'Drinks'})).status).toBe(403);expect(categories.mutate).not.toHaveBeenCalled();});
it('uses verified tenant context and bounded page options',async()=>{const {app,categories}=setup();expect((await request(app).get('/api/v1/categories?page=2&limit=20').set('Authorization','Bearer test')).status).toBe(200);expect(categories.list).toHaveBeenCalledWith('test',expect.objectContaining({orgId}),2,20);expect((await request(app).get('/api/v1/categories?limit=10000').set('Authorization','Bearer test')).status).toBe(400);});
it('owner creates a trimmed category with request ID',async()=>{const {app,categories}=setup();expect((await request(app).post('/api/v1/categories').set('Authorization','Bearer test').send({name:' Drinks '})).status).toBe(200);expect(categories.mutate).toHaveBeenCalledWith('test',expect.objectContaining({orgId}),'create',null,'Drinks',expect.any(String));});
it('rejects malformed category IDs',async()=>{const {app}=setup();expect((await request(app).patch('/api/v1/categories/not-a-uuid').set('Authorization','Bearer test').send({name:'Drinks'})).status).toBe(400);});

it("defaults category API to ten records per page",async()=>{const {app,categories}=setup();expect((await request(app).get("/api/v1/categories").set("Authorization","Bearer test")).status).toBe(200);expect(categories.list).toHaveBeenCalledWith("test",expect.objectContaining({orgId}),1,10);});

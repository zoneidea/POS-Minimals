import {expect,it,vi} from 'vitest';
import request from 'supertest';
import {createApp} from '../apps/api/src/app';
const id='10000000-0000-4000-8000-000000000001';
function setup(role='OWNER'){const list=vi.fn().mockResolvedValue({items:[],total:0,page:1,limit:10});return {list,app:createApp({activities:{list},resolveIdentity:async()=>({userId:id,orgId:id,orgName:'Shop',username:'Owner',role:role as 'OWNER',permissions:[]}),allowedOrigins:[],log:()=>{}})};}
it('requires authentication and owner role',async()=>{const owner=setup();expect((await request(owner.app).get('/api/v1/audits/activity-logs')).status).toBe(401);for(const role of ['EMPLOYEE','ACCOUNTANT']){const s=setup(role);expect((await request(s.app).get('/api/v1/audits/activity-logs').set('Authorization','Bearer token')).status).toBe(403);expect(s.list).not.toHaveBeenCalled();}});
it('derives organization from identity and validates filters',async()=>{const s=setup();expect((await request(s.app).get('/api/v1/audits/activity-logs?page=1&action=SALE_COMPLETED').set('Authorization','Bearer token')).status).toBe(200);expect(s.list).toHaveBeenCalledWith('token',expect.objectContaining({orgId:id}),{page:1,action:'SALE_COMPLETED'});expect((await request(s.app).get('/api/v1/audits/activity-logs?orgId=other').set('Authorization','Bearer token')).status).toBe(400);});

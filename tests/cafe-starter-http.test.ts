import {it,expect,vi} from 'vitest';import request from 'supertest';
import {createApp} from '../apps/api/src/app';import type {Role} from '../apps/api/src/modules/auth/types';import {ApiError} from '../apps/api/src/infra/errors';
function setup(role:Role='OWNER'){
 const service={read:vi.fn().mockResolvedValue({status:'AVAILABLE',remaining:0,catalog:{version:'cafe-starter-v1',categories:[],products:[],groups:[]}}),mutate:vi.fn().mockResolvedValue({status:'APPLIED',created:18})};
 const app=createApp({cafeStarter:service,resolveIdentity:async()=>({userId:'00000000-0000-4000-8000-000000000001',orgId:'00000000-0000-4000-8000-000000000001',orgName:'Cafe',username:'Owner',role,permissions:[]}),allowedOrigins:[],log:()=>{}});return {app,service};
}
const path='/api/v1/management/cafe/starter',body={action:'APPLY',packageVersion:'cafe-starter-v1'};
it('requires authentication and validates the action/version without accepting tenant or catalog overrides',async()=>{
 const {app,service}=setup();expect((await request(app).get(path)).status).toBe(401);expect((await request(app).get(path).set('Authorization','Bearer fixture')).status).toBe(200);
 for(const input of [{...body,orgId:'other'},{...body,action:'DELETE_ALL'},{...body,packageVersion:'v2'},{...body,products:[]},{}])expect((await request(app).post(path).set('Authorization','Bearer fixture').send(input)).status).toBe(400);
 expect(service.mutate).not.toHaveBeenCalled();
});
it.each(['EMPLOYEE','ACCOUNTANT'] as Role[])('rejects %s starter reads and mutations',async role=>{
 const {app,service}=setup(role);expect((await request(app).get(path).set('Authorization','Bearer fixture')).status).toBe(403);
 for(const action of ['APPLY','SKIP','CLEAR'])expect((await request(app).post(path).set('Authorization','Bearer fixture').send({...body,action})).status).toBe(403);expect(service.read).not.toHaveBeenCalled();expect(service.mutate).not.toHaveBeenCalled();
});
it.each(['APPLY','SKIP','CLEAR'])('sends owner %s through the scoped RPC service',async action=>{
 const {app,service}=setup();expect((await request(app).post(path).set('Authorization','Bearer fixture').send({...body,action})).status).toBe(200);expect(service.mutate).toHaveBeenCalledWith('fixture',action,expect.any(String));
});
it('retains an unsuccessful envelope on database conflicts',async()=>{const {app,service}=setup();service.mutate.mockRejectedValueOnce(new ApiError(409,'CAFE_MODE_REQUIRED','คาเฟ่เท่านั้น'));const r=await request(app).post(path).set('Authorization','Bearer fixture').send(body);expect(r.status).toBe(409);expect(r.body.success).toBe(false);});

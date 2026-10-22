import {expect,it,vi} from 'vitest';import request from 'supertest';
import {createApp} from '../apps/api/src/app';import type {Role} from '../apps/api/src/modules/auth/types';
const id='90000000-0000-4000-8000-000000000001';
function setup(role:Role){const management={invitationContext:vi.fn(),settings:vi.fn(),saveSettings:vi.fn(),members:vi.fn(),updateMember:vi.fn().mockResolvedValue({version:2}),invite:vi.fn(),accept:vi.fn()};return {management,app:createApp({management,resolveIdentity:async()=>({userId:id,orgId:id,orgName:'Shop',username:'Owner',role,permissions:['users:manage']}),allowedOrigins:[],log:()=>{}})};}
it.each(['EMPLOYEE','ACCOUNTANT'] as Role[])('rejects %s disabling or deleting users even with forged management permissions',async role=>{
 const {app,management}=setup(role);
 for(const status of ['SUSPENDED','DELETED'])expect((await request(app).patch(`/api/v1/users/${id}`).set('Authorization','Bearer fixture').send({role:'EMPLOYEE',status,version:1})).status).toBe(403);
 expect(management.updateMember).not.toHaveBeenCalled();
});
it.each(['SUSPENDED','ACTIVE','DELETED'])('allows only the owner to submit the versioned %s transition',async status=>{
 const {app,management}=setup('OWNER'),input={role:'EMPLOYEE',status,version:1};
 const res=await request(app).patch(`/api/v1/users/${id}`).set('Authorization','Bearer fixture').send(input);
 expect(res.status).toBe(200);expect(management.updateMember).toHaveBeenCalledWith('fixture',id,input,expect.any(String));
});
it('rejects missing authentication, forged shop IDs and stale changes without reporting success',async()=>{
 const {app,management}=setup('OWNER'),input={role:'EMPLOYEE',status:'SUSPENDED',version:1};
 expect((await request(app).patch(`/api/v1/users/${id}`).send(input)).status).toBe(401);
 expect((await request(app).patch(`/api/v1/users/${id}`).set('Authorization','Bearer fixture').send({...input,orgId:id})).status).toBe(400);expect(management.updateMember).not.toHaveBeenCalled();
 const {ApiError}=await import('../apps/api/src/infra/errors');management.updateMember.mockRejectedValueOnce(new ApiError(409,'VERSION_CONFLICT','โหลดข้อมูลล่าสุด'));
 const result=await request(app).patch(`/api/v1/users/${id}`).set('Authorization','Bearer fixture').send(input);expect(result.status).toBe(409);expect(result.body.success).toBe(false);
});

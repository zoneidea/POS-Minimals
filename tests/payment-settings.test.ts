import { describe,it,expect,vi } from 'vitest';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createApp } from '../apps/api/src/app.js';
import { paymentSettingsInput,maskAccount } from '../apps/api/src/modules/payments/schema.js';
import { createPaymentSettingsService } from '../apps/api/src/modules/payments/service.js';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../apps/api/src/infra/supabase/user-client.js',()=>({createUserClient:()=>({rpc})}));
const user=(role:'OWNER'|'EMPLOYEE'|'ACCOUNTANT')=>({userId:'00000000-0000-4000-8000-000000000001',orgId:'00000000-0000-4000-8000-000000000002',orgName:'Shop',username:'User',role,permissions:[]});
const input={mode:'GATEWAY' as const,qrImage:'',bankCode:'004' as const,accountNumber:'1234560123',accountName:'Account Holder',version:1};
describe('payment settings',()=>{
 it('validates bank codes and account digits; masks only final four digits',()=>{expect(paymentSettingsInput.safeParse(input).success).toBe(true);expect(paymentSettingsInput.safeParse({...input,bankCode:'4'}).success).toBe(false);expect(paymentSettingsInput.safeParse({...input,accountNumber:'123abc'}).success).toBe(false);expect(maskAccount(input.accountNumber)).toBe('xxx-x-xx012-3');});
 it('encrypts bank data and only returns masked account to owner/accountant',async()=>{let cipher:string|null=null;rpc.mockImplementation(async(name,args)=>name==='read_payment_settings'?{data:{cipher,version:1},error:null}:(cipher=args.p_cipher,{data:{version:2},error:null}));const service=createPaymentSettingsService('url','public','ab'.repeat(32));await service.save('jwt',input,'request');expect(cipher).not.toContain(input.accountNumber);expect(cipher).not.toContain(input.accountName);for(const role of ['OWNER','ACCOUNTANT'] as const){const view=await service.get('jwt',user(role));expect(view.accountName).toBe(input.accountName);expect(view.maskedAccountNumber).toBe('xxx-x-xx012-3');expect(view).not.toHaveProperty('accountNumber');}const employee=await service.get('jwt',user('EMPLOYEE'));expect(employee).not.toHaveProperty('maskedAccountNumber');expect(employee).not.toHaveProperty('bankCode');expect(employee).not.toHaveProperty('accountName');expect(employee.gatewayReady).toBe(false);});
 it('sends the persisted account holder name instead of the shop name',async()=>{let cipher:string|null=null,version=1;rpc.mockImplementation(async(name,args)=>name==='read_payment_settings'?{data:{cipher,version},error:null}:(cipher=args.p_cipher,version++,{data:{version},error:null}));const sync=vi.fn().mockResolvedValue('SENT'),service=createPaymentSettingsService('url','public','ab'.repeat(32),sync);expect(await service.save('jwt',{...input,accountName:'  Account Holder  '},'request',user('OWNER'))).toEqual({version:2,bankLinkStatus:'SENT'});expect(sync).toHaveBeenCalledWith(expect.objectContaining({name:'Account Holder',number:input.accountNumber,version:2}),'request');});
 it('requires a holder name for gateway without saving or linking',async()=>{rpc.mockResolvedValue({data:{cipher:null,version:1},error:null});const sync=vi.fn(),service=createPaymentSettingsService('url','public','ab'.repeat(32),sync);await expect(service.save('jwt',{...input,accountName:''},'request',user('OWNER'))).rejects.toMatchObject({status:400});expect(sync).not.toHaveBeenCalled();});
 it.each(['EMPLOYEE','ACCOUNTANT'] as const)('rejects %s edits at API',async(role)=>{const save=vi.fn(),app=createApp({allowedOrigins:[],log:vi.fn(),resolveIdentity:async()=>user(role),paymentSettings:{get:vi.fn(),save,unlink:vi.fn()}});expect((await request(app).patch('/api/v1/settings/payments').set('Authorization','Bearer jwt').send(input)).status).toBe(403);expect(save).not.toHaveBeenCalled();});
 it('permits owner edits and requires authentication',async()=>{const save=vi.fn().mockResolvedValue({version:2}),app=createApp({allowedOrigins:[],log:vi.fn(),resolveIdentity:async()=>user('OWNER'),paymentSettings:{get:vi.fn(),save,unlink:vi.fn()}});expect((await request(app).patch('/api/v1/settings/payments').send(input)).status).toBe(401);expect((await request(app).patch('/api/v1/settings/payments').set('Authorization','Bearer jwt').send(input)).status).toBe(200);});
 it('enforces tenant isolation, accountant read-only and stale versions in PostgreSQL',async()=>{const db=new PGlite();try{await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));await db.exec(readFileSync('supabase/migrations/202610110001_identity_tenants.sql','utf8'));await db.exec(readFileSync('supabase/migrations/202610140003_payment_settings.sql','utf8'));const owner=user('OWNER').userId,accountant='00000000-0000-4000-8000-000000000003',other='00000000-0000-4000-8000-000000000004',org=user('OWNER').orgId,otherOrg='00000000-0000-4000-8000-000000000005';await db.query('insert into auth.users values($1,now()),($2,now()),($3,now())',[owner,accountant,other]);await db.query("insert into public.organizations(id,name) values($1,'A'),($2,'B')",[org,otherOrg]);for(const [id,o,role] of [[owner,org,'OWNER'],[accountant,org,'ACCOUNTANT'],[other,otherOrg,'OWNER']])await db.query("insert into public.organization_members(org_id,user_id,display_username,role) values($1,$2,'User',$3)",[o,id,role]);await db.query("insert into public.store_settings(org_id,store_name) values($1,'A'),($2,'B')",[org,otherOrg]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);const call=()=>db.query("select public.save_payment_settings('encrypted',1,'10000000-0000-4000-8000-000000000001')");await call();await expect(call()).rejects.toThrow('VERSION_CONFLICT');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[accountant]);expect((await db.query<{v:{cipher:string}}>('select public.read_payment_settings() as v')).rows[0]!.v.cipher).toBe('encrypted');await expect(call()).rejects.toThrow('FORBIDDEN');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);expect((await db.query<{v:{cipher:null}}>('select public.read_payment_settings() as v')).rows[0]!.v.cipher).toBeNull();}finally{await db.close();}},15000);
});

describe('saved bank removal',()=>{
 function setup(status='SENT'){
  let cipher:string|null=null,version=1;
  rpc.mockImplementation(async(name,args)=>name==='read_payment_settings'?{data:{cipher,version},error:null}:(cipher=args.p_cipher,version++,{data:{version},error:null}));
  const unlink=vi.fn().mockResolvedValue(status),service=createPaymentSettingsService('url','public','ab'.repeat(32),undefined,unlink);
  return {service,unlink};
 }
 it('unlinks then soft-deletes and prevents reusing the removed number',async()=>{
  const {service,unlink}=setup();await service.save('jwt',input,'save');
  expect(await service.unlink('jwt',2,'delete',user('OWNER'))).toEqual({version:3});expect(unlink).toHaveBeenCalledWith(user('OWNER').orgId,2,'delete');
  const view=await service.get('jwt',user('OWNER'));expect(view).toMatchObject({mode:'DISABLED',maskedAccountNumber:'',accountName:'',bankCode:''});
  await expect(service.save('jwt',{...input,version:3,accountNumber:''},'save')).rejects.toMatchObject({status:400});
 });
 it('retains bank details when external unlink is not confirmed',async()=>{
  const {service}=setup('UNKNOWN');await service.save('jwt',input,'save');await expect(service.unlink('jwt',2,'delete',user('OWNER'))).rejects.toMatchObject({status:503});expect((await service.get('jwt',user('OWNER'))).maskedAccountNumber).toBe('xxx-x-xx012-3');
 });
 it('rejects stale versions and missing accounts before external calls',async()=>{
  const {service,unlink}=setup();await expect(service.unlink('jwt',1,'delete',user('OWNER'))).rejects.toMatchObject({status:404});await service.save('jwt',input,'save');await expect(service.unlink('jwt',1,'delete',user('OWNER'))).rejects.toMatchObject({status:409});expect(unlink).not.toHaveBeenCalled();
 });
 it.each(['EMPLOYEE','ACCOUNTANT'] as const)('denies %s unlink requests',async role=>{
  const {service,unlink}=setup();const app=createApp({allowedOrigins:[],log:vi.fn(),resolveIdentity:async()=>user(role),paymentSettings:service});expect((await request(app).post('/api/v1/settings/payments/unlink-bank').set('Authorization','Bearer jwt').send({version:1})).status).toBe(403);expect(unlink).not.toHaveBeenCalled();
 });
 it('requires authentication and refuses client-supplied shop IDs',async()=>{
  const {service,unlink}=setup();const app=createApp({allowedOrigins:[],log:vi.fn(),resolveIdentity:async()=>user('OWNER'),paymentSettings:service});expect((await request(app).post('/api/v1/settings/payments/unlink-bank').send({version:1})).status).toBe(401);expect((await request(app).post('/api/v1/settings/payments/unlink-bank').set('Authorization','Bearer jwt').send({version:1,contact_id:'other'})).status).toBe(400);expect(unlink).not.toHaveBeenCalled();
 });
});

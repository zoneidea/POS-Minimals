import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {RedisReadCache} from '../apps/api/src/infra/redis-read-cache';
import {createSessionAuthority} from '../apps/api/src/modules/auth/session-authority';
import {createApp} from '../apps/api/src/app';
import {NodeReadCache} from '../apps/api/src/infra/node-read-cache';
import {ApiError} from '../apps/api/src/infra/errors';
import type {UserContext} from '../apps/api/src/modules/auth/types';
const context:UserContext={userId:'00000000-0000-4000-8000-000000000001',orgId:'00000000-0000-4000-8000-000000000002',orgName:'Shop',username:'Owner',role:'OWNER',permissions:[]};
const sid='00000000-0000-4000-8000-000000000003';
const token=(sub=context.userId,session=sid,exp=Math.floor(Date.parse('2026-10-16T10:00:00Z')/1000))=>'header.'+Buffer.from(JSON.stringify({sub,session_id:session,exp})).toString('base64url')+'.signature';
function setup(){
 let now=Date.parse('2026-10-16T09:00:00Z');const entries=new Map<string,{value:string;expires:number}>();
 const get=(key:string)=>{const item=entries.get(key);return item&&item.expires>now?item.value:null;};
 const set=(key:string,value:string,ttl=Infinity)=>entries.set(key,{value,expires:now+ttl});
 const send=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  const args=JSON.parse(String(init?.body)) as (string|number)[];let result:unknown=null;
  if(args[0]==='SET'){set(String(args[1]),String(args[2]),Number(args[4]??Infinity));result='OK';}
  else{
   const script=String(args[1]),count=Number(args[2]),keys=args.slice(3,3+count).map(String),argv=args.slice(3+count),generation=get(keys[0]!)??'0';
   if(script.includes("return redis.call('SET',KEYS[2],'1'")){set(keys[0]!,String(argv[0]));set(keys[1]!,'1',300000);result='OK';}
   else if(!argv.length){
    if(count===4&&get(keys[2]!))result=['revoked',null];
    else if(count===4&&get(keys[3]!))result=['fresh',null];
    else{const value=get(keys[1]!);result=[generation,value?.startsWith(generation+':')?value.slice(generation.length+1):null];}
   }else if(generation===argv[0]&&!(count===4&&(get(keys[2]!)||get(keys[3]!)))){set(keys[1]!,generation+':'+argv[1],Number(argv[2]));result='OK';}
  }
  return Response.json({result});
 }) as unknown as typeof fetch;
 const load=vi.fn().mockResolvedValue(context),day=vi.fn().mockResolvedValue(Date.parse('2026-10-16T17:00:00Z')),verify=vi.fn().mockResolvedValue({id:context.userId}),end=vi.fn().mockResolvedValue(undefined);
 const make=()=>{const cache=new RedisReadCache('https://test.upstash.io','secret','a'.repeat(64),'auth-test',send,()=>now,vi.fn());return {cache,authority:createSessionAuthority(cache,load,day,verify,end,()=>now)};};
 const app=()=>{const {cache,authority}=make();return createApp({sessions:authority,checkSessionDay:authority.checkDay,resolveIdentity:authority.resolve,nodeCache:new NodeReadCache(Date.now,512,8192,cache),allowedOrigins:[],log:vi.fn(),categories:{list:vi.fn().mockResolvedValue({items:[],page:1,limit:10,total:0}),mutate:vi.fn()},management:{settings:vi.fn(),saveSettings:vi.fn(),members:vi.fn(),updateMember:vi.fn().mockResolvedValue({}),invite:vi.fn(),invitationContext:vi.fn(),accept:vi.fn()}});};
 return {make,app,send,load,day,verify,end,entries,advance:(ms:number)=>{now+=ms;}};
}
it('uses one verified context across requests and independent instances, without repeated Supabase calls',async()=>{
 const f=setup(),a=f.app(),b=f.app();
 for(const server of [a,b,a])expect((await request(server).get('/api/v1/auth/me').set('Authorization','Bearer '+token())).status).toBe(200);
 expect(f.load).toHaveBeenCalledTimes(1);expect(f.day).toHaveBeenCalledTimes(1);
 expect(await f.make().authority.checkDay(token())).toBe(Date.parse('2026-10-16T17:00:00Z'));
 // Session policy and route authorization share exactly one Redis read per request.
 const reads=vi.mocked(f.send).mock.calls.filter(([,init])=>{const a=JSON.parse(String(init?.body));return a[0]==='EVAL'&&a[2]===4&&a.length===7;});expect(reads).toHaveLength(4);
 expect(JSON.stringify([...f.entries.values()])).not.toMatch(/Shop|Owner|signature/);
});
it('revalidates on TTL expiry, refreshed token or different session, and denies forged tokens',async()=>{
 const f=setup(),a=f.make().authority;await a.resolve(token());f.advance(300001);await a.resolve(token());expect(f.load).toHaveBeenCalledTimes(2);
 await a.resolve(token(context.userId,'00000000-0000-4000-8000-000000000004'));expect(f.load).toHaveBeenCalledTimes(3);
 f.load.mockRejectedValueOnce(new ApiError(401,'UNAUTHENTICATED','invalid signature'));
 await expect(a.resolve(token()+'forged')).rejects.toMatchObject({status:401});
 await expect(a.resolve('malformed')).rejects.toMatchObject({status:401});
});
it('rejects token expiry and Thai-midnight expiry even when the context was cached',async()=>{
 const f=setup(),a=f.make().authority;await a.resolve(token());f.advance(3600001);
 await expect(a.resolve(token())).rejects.toMatchObject({status:401});
 const late=token(context.userId,sid,Math.floor(Date.parse('2026-10-17T03:00:00Z')/1000));await a.resolve(late);f.advance(7*3600000);
 await expect(a.resolve(late)).rejects.toMatchObject({code:'SESSION_DAY_EXPIRED'});
});
it('invalidates before role changes and cannot reuse old roles even when a later invalidation fails',async()=>{
 const f=setup(),a=f.make().authority,b=f.make().authority;await a.resolve(token());await a.beforeRoleChange();
 f.load.mockResolvedValue({...context,role:'EMPLOYEE',permissions:[]});expect((await b.resolve(token())).role).toBe('EMPLOYEE');
 f.load.mockRejectedValue(new ApiError(403,'FORBIDDEN','suspended'));await expect(a.resolve(token())).rejects.toMatchObject({status:403});
 f.advance(300001);await expect(b.resolve(token())).rejects.toMatchObject({status:403});
});
it('revokes all access tokens sharing the current session and leaves another device intact',async()=>{
 const f=setup(),a=f.make().authority,b=f.make().authority;await a.resolve(token());
 const refreshed=token(context.userId,sid,Math.floor(Date.parse('2026-10-16T11:00:00Z')/1000));await b.resolve(refreshed);
 await a.logout(token());expect(f.end).toHaveBeenCalledWith(token());await expect(b.resolve(token())).rejects.toMatchObject({code:'SESSION_REVOKED'});await expect(b.resolve(refreshed)).rejects.toMatchObject({code:'SESSION_REVOKED'});
 expect((await b.resolve(token(context.userId,'00000000-0000-4000-8000-000000000004'))).userId).toBe(context.userId);
});
it('falls back to fresh authority/session checks when Redis fails and fails closed for permission mutations',async()=>{
 const f=setup(),a=f.make().authority;vi.mocked(f.send).mockRejectedValue(new Error('offline'));
 await a.resolve(token());await a.resolve(token());expect(f.load).toHaveBeenCalledTimes(2);expect(f.day).toHaveBeenCalledTimes(2);
 await expect(a.beforeRoleChange()).rejects.toMatchObject({status:503});await expect(a.logout(token())).rejects.toMatchObject({status:503});expect(f.end).not.toHaveBeenCalled();
});
it('denies member mutation before fencing for employees and authenticates logout without membership',async()=>{
 const f=setup(),app=f.app();f.load.mockResolvedValue({...context,role:'EMPLOYEE'});
 expect((await request(app).patch('/api/v1/users/'+context.userId).set('Authorization','Bearer '+token()).send({role:'OWNER'})).status).toBe(403);
 f.load.mockRejectedValue(new ApiError(403,'FORBIDDEN','no membership'));
 expect((await request(app).post('/api/v1/auth/logout').set('Authorization','Bearer '+token())).status).toBe(200);
});
it('keeps onboarding and invitation access available before membership while protected data stays denied',async()=>{
 const f=setup(),{authority}=f.make();f.load.mockRejectedValue(new ApiError(403,'FORBIDDEN','no membership'));
 const app=createApp({sessions:authority,checkSessionDay:authority.checkDay,resolveIdentity:authority.resolve,bootstrapOrganization:vi.fn().mockResolvedValue({orgId:context.orgId,role:'OWNER',status:'ACTIVE'}),allowedOrigins:[],log:vi.fn()});
 expect((await request(app).post('/api/v1/orgs/bootstrap').set('Authorization','Bearer '+token()).send({storeName:'Shop',displayUsername:'Owner',phone:'0812345678'})).status).toBe(200);
 expect((await request(app).get('/api/v1/auth/me').set('Authorization','Bearer '+token())).status).toBe(403);
 f.load.mockResolvedValue(context);
 expect((await request(app).get('/api/v1/auth/me').set('Authorization','Bearer '+token())).status).toBe(200);
});
it('rejects a context belonging to another user and never ends a session when token verification fails',async()=>{
 const f=setup(),a=f.make().authority;f.load.mockResolvedValue({...context,userId:'00000000-0000-4000-8000-000000000099'});
 await expect(a.resolve(token())).rejects.toMatchObject({status:401});
 f.verify.mockRejectedValue(new ApiError(401,'UNAUTHENTICATED','forged'));
 await expect(a.logout(token()+'forged')).rejects.toMatchObject({status:401});expect(f.end).not.toHaveBeenCalled();
});
it('does not execute a staff mutation if Redis fencing is unavailable',async()=>{
 const f=setup(),{authority}=f.make(),updateMember=vi.fn();vi.mocked(f.send).mockRejectedValue(new Error('offline'));
 const app=createApp({sessions:authority,checkSessionDay:authority.checkDay,resolveIdentity:authority.resolve,allowedOrigins:[],log:vi.fn(),management:{settings:vi.fn(),saveSettings:vi.fn(),members:vi.fn(),updateMember,invite:vi.fn(),invitationContext:vi.fn(),accept:vi.fn()}});
 expect((await request(app).patch('/api/v1/users/'+context.userId).set('Authorization','Bearer '+token()).send({role:'EMPLOYEE',status:'SUSPENDED',version:1})).status).toBe(503);
 expect(updateMember).not.toHaveBeenCalled();
});

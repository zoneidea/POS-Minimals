import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {RedisReadCache,createRedisReadCache} from '../apps/api/src/infra/redis-read-cache';
import {NodeReadCache,cachedRead} from '../apps/api/src/infra/node-read-cache';
import {createApp} from '../apps/api/src/app';
import {ApiError} from '../apps/api/src/infra/errors';
import type {UserContext} from '../apps/api/src/modules/auth/types';
const context:UserContext={userId:'00000000-0000-4000-8000-000000000001',orgId:'00000000-0000-4000-8000-000000000002',orgName:'Shop',username:'Owner',role:'OWNER',permissions:[]};
function fixture(){
 let now=1000;const values=new Map<string,{value:string;expires:number}>();
 const get=(key:string)=>{const entry=values.get(key);return entry&&entry.expires>now?entry.value:null;};
 const transport=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  const args=JSON.parse(String(init?.body)) as (string|number)[];let result:unknown;
  if(args[0]==='SET'){values.set(String(args[1]),{value:String(args[2]),expires:Infinity});result='OK';}
  else{
   const generation=get(String(args[3]))??'0',key=String(args[4]);
   if(args.length===5){const value=get(key);result=[generation,value?.startsWith(generation+':')?value.slice(generation.length+1):null];}
   else if(args[5]===generation){values.set(key,{value:generation+':'+args[6],expires:now+Number(args[7])});result='OK';}
   else result=null;
  }
  return Response.json({result});
 }) as unknown as typeof fetch;
 const make=(namespace='test',background?:(work:Promise<void>)=>void)=>new RedisReadCache('https://example.upstash.io','secret-token','a'.repeat(64),namespace,transport,()=>now,vi.fn(),background);
 return {make,values,transport,advance:(ms:number)=>{now+=ms;}};
}
it('shares encrypted data across independent instances, expires and isolates returned values',async()=>{
 const f=fixture(),a=f.make(),b=f.make(),load=vi.fn().mockResolvedValue({phone:'0812345678',name:'Private shop'});
 const first=await a.read<{name:string}>('key',30000,load);first.name='changed';
 expect(await b.read('key',30000,load)).toEqual({phone:'0812345678',name:'Private shop'});expect(load).toHaveBeenCalledTimes(1);
 expect(JSON.stringify([...f.values.values()])).not.toMatch(/0812345678|Private shop/);
 f.advance(30000);await b.read('key',30000,load);expect(load).toHaveBeenCalledTimes(2);
});
it('invalidates every instance and prevents stale pending loads from refilling',async()=>{
 const f=fixture(),a=f.make(),b=f.make();let release!:(value:string)=>void;
 const pending=a.read('key',30000,()=>new Promise<string>(resolve=>{release=resolve;}));
 await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
 await b.invalidate();release('old');expect(await pending).toBe('old');
 expect(await b.read('key',30000,async()=>'fresh')).toBe('fresh');
 expect(await a.read('key',30000,async()=>'wrong')).toBe('fresh');
});
it('falls back on Redis failures, opens a short circuit and propagates database failures once',async()=>{
 const f=fixture(),a=f.make(),load=vi.fn().mockResolvedValue('database');
 vi.mocked(f.transport).mockRejectedValueOnce(new Error('private credentials must not escape'));
 expect(await a.read('key',30000,load)).toBe('database');expect(await a.read('key',30000,load)).toBe('database');
 expect(f.transport).toHaveBeenCalledTimes(1);expect(load).toHaveBeenCalledTimes(2);
 f.advance(30001);await a.read('key',30000,load);expect(f.transport).toHaveBeenCalledTimes(3);
 const failing=vi.fn().mockRejectedValue(new Error('database unavailable'));
 await expect(a.read('other',30000,failing)).rejects.toThrow('database unavailable');expect(failing).toHaveBeenCalledTimes(1);
});
it('rejects corrupt ciphertext and bounds payloads without exposing or caching failures',async()=>{
 const f=fixture(),a=f.make();await a.read('key',30000,async()=>({private:'data'}));
 const entry=[...f.values.entries()][0]!;f.values.set(entry[0],{...entry[1],value:'0:corrupt'});
 expect(await a.read('key',30000,async()=>'database')).toBe('database');
 const b=f.make('large'),big=vi.fn().mockResolvedValue('x'.repeat(512*1024));
 await b.read('big',30000,big);await b.read('big',30000,big);expect(big).toHaveBeenCalledTimes(2);
});
it('isolates user, token, tenant, role, query, environment and keeps stock outside Redis',async()=>{
 const f=fixture(),cache=new NodeReadCache(Date.now,512,8192,f.make()),load=vi.fn().mockResolvedValue('data');
 for(const [token,ctx,page] of [['a',context,1],['b',context,1],['a',{...context,orgId:'other'},1],['a',{...context,role:'EMPLOYEE'},1],['a',context,2]] as [string,UserContext,number][])
  await cachedRead(cache,token,ctx,'categories',page,30000,load);
 expect(load).toHaveBeenCalledTimes(5);
 const before=vi.mocked(f.transport).mock.calls.length;await cachedRead(cache,'a',context,'products',1,3000,load);
 expect(vi.mocked(f.transport).mock.calls.length).toBe(before);
 expect(await f.make('other-environment').read('key',30000,async()=>'separate')).toBe('separate');
});
it('checks live authorization even on Redis hits and awaits invalidation before acknowledging changes',async()=>{
 const f=fixture(),resolve=vi.fn().mockResolvedValue(context),list=vi.fn().mockResolvedValue({items:[],page:1,limit:10,total:0});
 const categories={list,mutate:vi.fn().mockResolvedValue({id:context.orgId,name:'New'})};
 const app=()=>createApp({nodeCache:new NodeReadCache(Date.now,512,8192,f.make()),resolveIdentity:resolve,categories,log:vi.fn(),allowedOrigins:[]});
 const a=app(),b=app();for(const server of [a,b])expect((await request(server).get('/api/v1/categories').set('Authorization','Bearer token')).status).toBe(200);
 expect(list).toHaveBeenCalledTimes(1);expect(resolve).toHaveBeenCalledTimes(2);
 resolve.mockRejectedValueOnce(new ApiError(403,'FORBIDDEN','Suspended'));
 expect((await request(b).get('/api/v1/categories').set('Authorization','Bearer token')).status).toBe(403);
 expect((await request(a).post('/api/v1/categories').set('Authorization','Bearer token').send({name:'New'})).status).toBe(200);
 await request(b).get('/api/v1/categories').set('Authorization','Bearer token');expect(list).toHaveBeenCalledTimes(2);
 resolve.mockResolvedValue({...context,role:'ACCOUNTANT'});
 expect((await request(b).get('/api/v1/categories').set('Authorization','Bearer token')).status).toBe(403);
});
it('is optional and requires complete server-only configuration',()=>{
 expect(createRedisReadCache({})).toBeUndefined();
 expect(createRedisReadCache({UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'token',SALE_SNAPSHOT_KEY:'a'.repeat(64)})).toBeInstanceOf(RedisReadCache);
});
it('shares store reads, invalidates saved store settings and rejects employees before cache access',async()=>{
 const f=fixture(),resolve=vi.fn().mockResolvedValue(context);
 const input={storeName:'Updated',address:'',phone:'',taxId:'',promptpayIdentifier:'',receiptFooter:'',vatEnabled:false,vatRate:'7.00',autoOpenPrintDialog:false,version:1};
 const management={settings:vi.fn().mockResolvedValue(input),saveSettings:vi.fn().mockResolvedValue({...input,version:2}),members:vi.fn(),updateMember:vi.fn(),invite:vi.fn(),invitationContext:vi.fn(),accept:vi.fn()};
 const app=()=>createApp({nodeCache:new NodeReadCache(Date.now,512,8192,f.make()),resolveIdentity:resolve,management,log:vi.fn(),allowedOrigins:[]});
 const a=app(),b=app();
 for(const server of [a,b])expect((await request(server).get('/api/v1/settings/store').set('Authorization','Bearer token')).status).toBe(200);
 expect(management.settings).toHaveBeenCalledTimes(1);
 expect((await request(a).patch('/api/v1/settings/store').set('Authorization','Bearer token').send(input)).status).toBe(200);
 await request(b).get('/api/v1/settings/store').set('Authorization','Bearer token');expect(management.settings).toHaveBeenCalledTimes(2);
 resolve.mockResolvedValue({...context,role:'EMPLOYEE'});
 const commands=vi.mocked(f.transport).mock.calls.length;
 expect((await request(b).get('/api/v1/settings/store').set('Authorization','Bearer token')).status).toBe(403);
 expect((await request(b).patch('/api/v1/settings/store').set('Authorization','Bearer token').send(input)).status).toBe(403);
 expect(vi.mocked(f.transport).mock.calls.length).toBe(commands);
});
it('does not break a successful mutation when shared invalidation is unavailable',async()=>{
 const f=fixture();vi.mocked(f.transport).mockRejectedValue(new Error('offline'));
 const categories={list:vi.fn(),mutate:vi.fn().mockResolvedValue({id:context.orgId,name:'New'})};
 const app=createApp({nodeCache:new NodeReadCache(Date.now,512,8192,f.make()),resolveIdentity:async()=>context,categories,log:vi.fn(),allowedOrigins:[]});
 expect((await request(app).post('/api/v1/categories').set('Authorization','Bearer token').send({name:'New'})).status).toBe(200);
 expect(categories.mutate).toHaveBeenCalledTimes(1);
});
it('returns a cache miss without awaiting background fill and still rejects a stale fill after invalidation',async()=>{
 const f=fixture(),jobs:Promise<void>[]=[],a=f.make('test',work=>jobs.push(work)),b=f.make();
 const original=vi.mocked(f.transport).getMockImplementation()!;let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 vi.mocked(f.transport).mockImplementation(async(url,init)=>{
  const args=JSON.parse(String(init?.body));if(args[0]==='EVAL'&&args.length===8)await gate;
  return original(url,init);
 });
 expect(await a.read('key',30000,async()=>'old')).toBe('old');expect(jobs).toHaveLength(1);
 await b.invalidate();release();await Promise.all(jobs);
 expect(await b.read('key',30000,async()=>'fresh')).toBe('fresh');
});

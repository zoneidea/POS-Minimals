import {describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {createDailySessionGuard} from '../apps/api/src/infra/daily-session.js';
import {createApp} from '../apps/api/src/app.js';
import {NodeReadCache} from '../apps/api/src/infra/node-read-cache.js';
import {ApiError} from '../apps/api/src/infra/errors.js';
import {readDailyExpiry,writeDailyExpiry,clearDailyAuthStorage,tokenSessionId} from '../apps/web/src/lib/daily-session-state';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../apps/api/src/infra/supabase/user-client.js',()=>({createUserClient:()=>({rpc})}));
const midnight=Date.parse('2026-10-15T17:00:00Z');
describe('daily authenticated session boundary',()=>{
 it('caches only immutable expiry and rejects at Thai midnight',async()=>{let now=midnight-1000;rpc.mockResolvedValue({data:new Date(midnight).toISOString(),error:null});const guard=createDailySessionGuard('url','key',()=>now);expect(await guard('token')).toBe(midnight);await guard('token');expect(rpc).toHaveBeenCalledTimes(1);now=midnight;await expect(guard('token')).rejects.toMatchObject({status:401,code:'SESSION_DAY_EXPIRED'});});
 it('refreshed tokens cannot extend an old session',async()=>{rpc.mockResolvedValue({data:new Date(midnight).toISOString(),error:null});const guard=createDailySessionGuard('url','key',()=>midnight+100);await expect(guard('refreshed-token')).rejects.toMatchObject({code:'SESSION_DAY_EXPIRED'});});
 it('fails closed when expiry is unavailable or invalid',async()=>{for(const result of [{data:null,error:{code:'error'}},{data:'invalid',error:null}]){rpc.mockResolvedValue(result);await expect(createDailySessionGuard('url','key')('token')).rejects.toMatchObject({status:503});}});
 it('checks expiry before identity and cached data, leaving public health accessible',async()=>{let expired=false;const resolve=vi.fn().mockResolvedValue({userId:'id',orgId:'org',orgName:'Shop',username:'Owner',role:'OWNER',permissions:[]});const app=createApp({nodeCache:new NodeReadCache(),checkSessionDay:async()=>{if(expired)throw new ApiError(401,'SESSION_DAY_EXPIRED','Expired');return midnight;},resolveIdentity:resolve,allowedOrigins:[],log:vi.fn()});expect((await request(app).get('/api/v1/auth/me').set('Authorization','Bearer token')).status).toBe(200);expired=true;const response=await request(app).get('/api/v1/auth/me').set('Authorization','Bearer token');expect(response.status).toBe(401);expect(response.body.error.code).toBe('SESSION_DAY_EXPIRED');expect(resolve).toHaveBeenCalledTimes(1);expect((await request(app).get('/api/v1/health')).status).toBe(200);});
});
describe('browser daily session metadata',()=>{
 it('retains expiry across token refresh of the same session, not a different session',()=>{const map=new Map<string,string>(),storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);}};writeDailyExpiry(storage,'auth','session-1',midnight);expect(readDailyExpiry(storage,'auth','session-1')).toBe(midnight);expect(readDailyExpiry(storage,'auth','session-2')).toBe(0);storage.setItem('cart','items');storage.setItem('auth','token');clearDailyAuthStorage(storage,'auth');expect(map.has('auth')).toBe(false);expect(map.has('auth:day-expiry')).toBe(false);expect(map.get('cart')).toBe('items');});
 it('uses session_id rather than the refreshed iat claim',()=>{const encode=(iat:number)=>'header.'+btoa(JSON.stringify({session_id:'same-session',iat}))+'.signature';expect(tokenSessionId(encode(1))).toBe('same-session');expect(tokenSessionId(encode(999))).toBe('same-session');expect(tokenSessionId('malformed')).toBeUndefined();});
});

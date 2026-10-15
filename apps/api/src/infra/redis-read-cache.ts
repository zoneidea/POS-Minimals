import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {timeStep} from './request-timing.js';
import {waitUntil} from '@vercel/functions';
import {ApiError} from './errors.js';

// Generation and value are read atomically. Stale in-flight loads cannot refill
// the cache after another Vercel instance invalidates the namespace.
const READ="local g=redis.call('GET',KEYS[1]) or '0'; local v=redis.call('GET',KEYS[2]); if v and string.sub(v,1,string.len(g)+1)==g..':' then return {g,string.sub(v,string.len(g)+2)} end; return {g,false}";
const WRITE="local g=redis.call('GET',KEYS[1]) or '0'; if g==ARGV[1] then return redis.call('SET',KEYS[2],g..':'..ARGV[2],'PX',ARGV[3]) end; return false";
const AUTH_READ="if redis.call('EXISTS',KEYS[3])==1 then return {'revoked',false} end; if redis.call('EXISTS',KEYS[4])==1 then return {'fresh',false} end; "+READ;
const AUTH_WRITE="if redis.call('EXISTS',KEYS[3])==1 or redis.call('EXISTS',KEYS[4])==1 then return false end; "+WRITE;
export interface SharedReadCache {
 read<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>;
 invalidate():Promise<void>;
}
export class RedisReadCache implements SharedReadCache {
 private cipherKey:Buffer;private prefix:string;private unavailableUntil=0;private lastWarning=-Infinity;
 constructor(private url:string,private token:string,encryptionKey:string,namespace:string,
  private transport:typeof fetch=fetch,private now=Date.now,private warn:()=>void=()=>{process.stderr.write('Shared read cache unavailable; using database\n');},private background?:(work:Promise<void>)=>void){
  this.cipherKey=createHash('sha256').update('pos-redis-read-cache-v1:').update(encryptionKey).digest();
  this.prefix='pos:read:v1:'+createHash('sha256').update(namespace).digest('hex');
 }
 private failed(){this.unavailableUntil=this.now()+30000;if(this.now()-this.lastWarning>=60000){this.lastWarning=this.now();this.warn();}}
 private async command(command:(string|number)[]){
  return timeStep('redis',async()=>{
  const response=await this.transport(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(800)});
  if(!response.ok)throw new Error('Redis unavailable');
  const body=await response.json() as {result?:unknown;error?:unknown};
  if(body.error||!Object.hasOwn(body,'result'))throw new Error('Redis rejected command');
  return body.result;
  });
 }
 private encrypt(value:unknown,key:string){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.cipherKey,iv);cipher.setAAD(Buffer.from(key));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
 }
 private decrypt<T>(value:string,key:string):T{
  const bytes=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',this.cipherKey,bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(key));cipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8')) as T;
 }
 read<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>{return this.readEntry(key,ttl,load);}
 readAuth<T>(key:string,session:string,ttl:number,load:()=>Promise<T>):Promise<T>{return this.readEntry('auth:'+key,ttl,load,session);}
 private async readEntry<T>(key:string,ttl:number,load:()=>Promise<T>,session?:string):Promise<T>{
  if(this.now()<this.unavailableUntil)return timeStep('data',load);
  const started=this.now(),dataKey=this.prefix+':'+key;let generation:string;
  try{
   const keys=[this.prefix+':generation',dataKey,...(session?[this.prefix+':revoked:'+session,this.prefix+':auth-fence']:[])];
   const result=await this.command(['EVAL',session?AUTH_READ:READ,keys.length,...keys]);
   if(!Array.isArray(result)||typeof result[0]!=='string')throw new Error('Invalid cache value');
   generation=result[0];
   if(session&&generation==='revoked')throw new ApiError(401,'SESSION_REVOKED','เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่');
   if(session&&generation==='fresh')return timeStep('data',load);
   if(typeof result[1]==='string')return this.decrypt<T>(result[1],dataKey);
  }catch(error){if(error instanceof ApiError)throw error;this.failed();return timeStep('data',load);}
  // Database errors propagate normally and are never cached or silently retried.
  const value=await timeStep('data',load),remaining=ttl-(this.now()-started);
  const fill=async()=>{if(remaining>0)try{
   const encrypted=this.encrypt(value,dataKey);
   const keys=[this.prefix+':generation',dataKey,...(session?[this.prefix+':revoked:'+session,this.prefix+':auth-fence']:[])];
   if(encrypted.length<=512*1024)await this.command(['EVAL',session?AUTH_WRITE:WRITE,keys.length,...keys,generation,encrypted,remaining]);
  }catch{this.failed();}
  };
  if(this.background&&!session)this.background(fill());else await fill();
  return value;
 }
 async invalidate(){
  try{await this.command(['SET',this.prefix+':generation',randomUUID()]);}
  catch{this.failed();}
 }
 async fenceAuth(){
  // A fence lasts longer than the function runtime and the full auth-cache TTL.
  // In-flight reads cannot repopulate old roles even if the mutation later fails.
  try{await this.command(['EVAL',"redis.call('SET',KEYS[1],ARGV[1]); return redis.call('SET',KEYS[2],'1','PX',300000)",2,this.prefix+':generation',this.prefix+':auth-fence',randomUUID()]);}
  catch{this.failed();throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถเตรียมการเปลี่ยนสิทธิ์ได้ กรุณาลองใหม่');}
 }
 async revokeSession(session:string,ttl:number){
  try{await this.command(['SET',this.prefix+':revoked:'+session,'1','PX',Math.max(1,Math.ceil(ttl))]);}
  catch{this.failed();throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถยกเลิกเซสชันได้ กรุณาลองใหม่');}
 }
}
export function createRedisReadCache(env:NodeJS.ProcessEnv=process.env):RedisReadCache|undefined{
 if(!env.UPSTASH_REDIS_REST_URL&&!env.UPSTASH_REDIS_REST_TOKEN)return undefined;
 const url=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN,key=env.SALE_SNAPSHOT_KEY;
 if(!url||!token||!key||!/^[a-f\d]{64}$/i.test(key)||!/^https:\/\/[^/]+\/?$/.test(url)){
  process.stderr.write('Shared read cache configuration incomplete; using Node cache\n');return undefined;
 }
 return new RedisReadCache(url,token,key,JSON.stringify([env.SUPABASE_URL,env.VERCEL_ENV??'local',env.UPSTASH_CACHE_NAMESPACE??env.APP_PUBLIC_URL??'pos']),fetch,Date.now,undefined,env.VERCEL?work=>waitUntil(work):undefined);
}

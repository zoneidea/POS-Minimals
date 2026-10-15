import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';

// Generation and value are read atomically. Stale in-flight loads cannot refill
// the cache after another Vercel instance invalidates the namespace.
const READ="local g=redis.call('GET',KEYS[1]) or '0'; local v=redis.call('GET',KEYS[2]); if v and string.sub(v,1,string.len(g)+1)==g..':' then return {g,string.sub(v,string.len(g)+2)} end; return {g,false}";
const WRITE="local g=redis.call('GET',KEYS[1]) or '0'; if g==ARGV[1] then return redis.call('SET',KEYS[2],g..':'..ARGV[2],'PX',ARGV[3]) end; return false";
export interface SharedReadCache {
 read<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>;
 invalidate():Promise<void>;
}
export class RedisReadCache implements SharedReadCache {
 private cipherKey:Buffer;private prefix:string;private unavailableUntil=0;private lastWarning=-Infinity;
 constructor(private url:string,private token:string,encryptionKey:string,namespace:string,
  private transport:typeof fetch=fetch,private now=Date.now,private warn:()=>void=()=>{process.stderr.write('Shared read cache unavailable; using database\n');}){
  this.cipherKey=createHash('sha256').update('pos-redis-read-cache-v1:').update(encryptionKey).digest();
  this.prefix='pos:read:v1:'+createHash('sha256').update(namespace).digest('hex');
 }
 private failed(){this.unavailableUntil=this.now()+30000;if(this.now()-this.lastWarning>=60000){this.lastWarning=this.now();this.warn();}}
 private async command(command:(string|number)[]){
  const response=await this.transport(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(800)});
  if(!response.ok)throw new Error('Redis unavailable');
  const body=await response.json() as {result?:unknown;error?:unknown};
  if(body.error||!Object.hasOwn(body,'result'))throw new Error('Redis rejected command');
  return body.result;
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
 async read<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>{
  if(this.now()<this.unavailableUntil)return load();
  const started=this.now(),dataKey=this.prefix+':'+key;let generation:string;
  try{
   const result=await this.command(['EVAL',READ,2,this.prefix+':generation',dataKey]);
   if(!Array.isArray(result)||typeof result[0]!=='string')throw new Error('Invalid cache value');
   generation=result[0];
   if(typeof result[1]==='string')return this.decrypt<T>(result[1],dataKey);
  }catch{this.failed();return load();}
  // Database errors propagate normally and are never cached or silently retried.
  const value=await load(),remaining=ttl-(this.now()-started);
  if(remaining>0)try{
   const encrypted=this.encrypt(value,dataKey);
   if(encrypted.length<=512*1024)await this.command(['EVAL',WRITE,2,this.prefix+':generation',dataKey,generation,encrypted,remaining]);
  }catch{this.failed();}
  return value;
 }
 async invalidate(){
  try{await this.command(['SET',this.prefix+':generation',randomUUID()]);}
  catch{this.failed();}
 }
}
export function createRedisReadCache(env:NodeJS.ProcessEnv=process.env):SharedReadCache|undefined{
 if(!env.UPSTASH_REDIS_REST_URL&&!env.UPSTASH_REDIS_REST_TOKEN)return undefined;
 const url=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN,key=env.SALE_SNAPSHOT_KEY;
 if(!url||!token||!key||!/^[a-f\d]{64}$/i.test(key)||!/^https:\/\/[^/]+\/?$/.test(url)){
  process.stderr.write('Shared read cache configuration incomplete; using Node cache\n');return undefined;
 }
 return new RedisReadCache(url,token,key,JSON.stringify([env.SUPABASE_URL,env.VERCEL_ENV??'local',env.UPSTASH_CACHE_NAMESPACE??env.APP_PUBLIC_URL??'pos']));
}

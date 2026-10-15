import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {UserContext,ResolveIdentity} from '../modules/auth/types.js';
import type {SharedReadCache} from './redis-read-cache.js';
type Entry={expires:number;iv:Buffer;tag:Buffer;data:Buffer};
// Per-process, bounded and encrypted. Never caches authorization decisions.
export class NodeReadCache {
 private key=randomBytes(32);private entries=new Map<string,Entry>();private pending=new Map<string,Promise<unknown>>();private epoch=0;private bytes=0;
 constructor(private now=Date.now,private maxEntries=512,private maxBytes=8*1024*1024,readonly shared?:SharedReadCache){}
 clear(){this.epoch++;this.entries.clear();this.pending.clear();this.bytes=0;}
 private remove(key:string){const entry=this.entries.get(key);if(entry){this.bytes-=entry.data.length;this.entries.delete(key);}}
 async read<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>{
  for(const [id,entry]of this.entries)if(entry.expires<=this.now())this.remove(id);
  const entry=this.entries.get(key);
  if(entry){this.entries.delete(key);this.entries.set(key,entry);const cipher=createDecipheriv('aes-256-gcm',this.key,entry.iv);cipher.setAuthTag(entry.tag);return JSON.parse(Buffer.concat([cipher.update(entry.data),cipher.final()]).toString('utf8')) as T;}
  return this.coalesce(key,async()=>{const epoch=this.epoch,started=this.now(),value=await load();if(epoch===this.epoch&&started+ttl>this.now()){
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
   if(data.length<=this.maxBytes&&this.maxEntries>0){this.remove(key);this.entries.set(key,{expires:started+ttl,iv,tag:cipher.getAuthTag(),data});this.bytes+=data.length;while(this.entries.size>this.maxEntries||this.bytes>this.maxBytes)this.remove(this.entries.keys().next().value!);}
  }return value;});
 }
 async coalesce<T>(key:string,load:()=>Promise<T>):Promise<T>{
  const current=this.pending.get(key);if(current)return structuredClone(await current) as T;
  if(this.pending.size>=256)return load();
  const promise=Promise.resolve().then(load);this.pending.set(key,promise);
  try{return structuredClone(await promise);}finally{if(this.pending.get(key)===promise)this.pending.delete(key);}
 }
}
export function cachedRead<T>(cache:NodeReadCache|undefined,token:string,context:UserContext,kind:string,query:unknown,ttl:number,load:()=>Promise<T>):Promise<T>{
 if(!cache)return load();
 const key=createHash('sha256').update(JSON.stringify([token,context,kind,query])).digest('hex');
 if(cache.shared&&['store','categories'].includes(kind))return cache.coalesce('shared:'+key,()=>cache.shared!.read(key,ttl,load));
 return cache.read(key,ttl,load);
}
export function coalesceIdentity(cache:NodeReadCache|undefined,resolve:ResolveIdentity):ResolveIdentity{
 if(!cache)return resolve;
 return token=>cache.coalesce('identity:'+createHash('sha256').update(token).digest('hex'),()=>resolve(token));
}

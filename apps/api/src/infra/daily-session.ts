import {createHash} from 'node:crypto';
import {createUserClient} from './supabase/user-client.js';
import {ApiError} from './errors.js';
import {NodeReadCache} from './node-read-cache.js';
export function createDailySessionGuard(url:string,key:string,now=Date.now){
 // Cache only the immutable expiry timestamp, never current membership or permissions.
 const cache=new NodeReadCache(now,1024,128*1024);
 return async(token:string):Promise<number>=>{
  const hash=createHash('sha256').update(token).digest('hex');
  const time=now(),nextMidnight=(Math.floor((time+7*3600000)/86400000)+1)*86400000-7*3600000;
  const expires=await cache.read(hash,nextMidnight-time,async()=>{
   const {data,error}=await createUserClient(url,key,token).rpc('current_session_expires_at');
   if(error){const unauth=['PT401','PGRST301','PGRST302','PGRST303'].includes(error.code);throw new ApiError(unauth?401:503,unauth?'UNAUTHENTICATED':'SERVICE_UNAVAILABLE','ไม่สามารถตรวจสอบอายุการเข้าสู่ระบบได้');}
   const value=typeof data==='string'?Date.parse(data):NaN;
   if(!Number.isFinite(value))throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถตรวจสอบอายุการเข้าสู่ระบบได้');
   return value;
  });
  if(expires<=now())throw new ApiError(401,'SESSION_DAY_EXPIRED','หมดเวลาการใช้งานของวัน กรุณาเข้าสู่ระบบใหม่');
  return expires;
 };
}

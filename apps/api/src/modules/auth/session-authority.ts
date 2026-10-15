import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {requestOnce} from '../../infra/request-timing.js';
import type {RedisReadCache} from '../../infra/redis-read-cache.js';
import type {ResolveIdentity} from './types.js';
const claims=z.object({sub:z.uuid(),session_id:z.uuid(),exp:z.number().int().positive()});
const userContextSchema=z.object({userId:z.uuid(),orgId:z.uuid(),orgName:z.string(),username:z.string(),role:z.enum(['OWNER','EMPLOYEE','ACCOUNTANT']),permissions:z.array(z.string())}).strict();
const entry=z.object({context:userContextSchema,expiresAt:z.number().finite()});
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function createSessionAuthority(cache:Pick<RedisReadCache,'readAuth'|'revokeSession'|'fenceAuth'>,resolve:ResolveIdentity,checkDay:(token:string)=>Promise<number>,verifyToken:(token:string)=>Promise<{id:string}>,endSession:(token:string)=>Promise<void>,now=Date.now){
 function tokenInfo(token:string){
  try{if(token.length>16384)throw new Error();return claims.parse(JSON.parse(Buffer.from(token.split('.')[1]??'','base64url').toString('utf8')));}
  catch{throw new ApiError(401,'UNAUTHENTICATED','กรุณาเข้าสู่ระบบอีกครั้ง');}
 }
 function authenticate(token:string){
  // Claims only restrict lifetime/scope here. A cache hit requires the exact
  // fingerprint of a token verified by Supabase on the original cache miss.
  const info=tokenInfo(token),time=now(),midnight=(Math.floor((time+7*3600000)/86400000)+1)*86400000-7*3600000;
  if(info.exp*1000<=time)throw new ApiError(401,'UNAUTHENTICATED','กรุณาเข้าสู่ระบบอีกครั้ง');
  const ttl=Math.min(300000,info.exp*1000-time,midnight-time),fingerprint=hash(token);
  return requestOnce('session:'+fingerprint,async()=>{
   const value=entry.parse(await cache.readAuth(fingerprint,hash(info.session_id),ttl,async()=>{
    const [context,expiresAt]=await Promise.all([resolve(token),requestOnce('live-day:'+fingerprint,()=>checkDay(token))]);
    if(context.userId!==info.sub)throw new ApiError(401,'UNAUTHENTICATED','กรุณาเข้าสู่ระบบอีกครั้ง');
    return {context,expiresAt};
   }));
   if(value.context.userId!==info.sub)throw new ApiError(401,'UNAUTHENTICATED','กรุณาเข้าสู่ระบบอีกครั้ง');
   if(value.expiresAt<=now())throw new ApiError(401,'SESSION_DAY_EXPIRED','หมดเวลาการใช้งานของวัน กรุณาเข้าสู่ระบบใหม่');
   return value;
  });
 }
 return {
  resolve:async(token:string)=>(await authenticate(token)).context,
  checkDay:async(token:string)=>{
   try{return (await authenticate(token)).expiresAt;}
   catch(error){
    // Signup/onboarding and invitation acceptance need a valid Auth session
    // before an active membership exists. Resource routes still require resolve.
    if(error instanceof ApiError&&error.status===403)return requestOnce('live-day:'+hash(token),()=>checkDay(token));
    throw error;
   }
  },
  beforeRoleChange:()=>cache.fenceAuth(),
  async logout(token:string){const info=tokenInfo(token),user=await verifyToken(token);if(user.id!==info.sub)throw new ApiError(401,'UNAUTHENTICATED','กรุณาเข้าสู่ระบบอีกครั้ง');const midnight=(Math.floor((now()+7*3600000)/86400000)+1)*86400000-7*3600000;await cache.revokeSession(hash(info.session_id),midnight-now());await endSession(token);},
 };
}
export type SessionAuthority=ReturnType<typeof createSessionAuthority>;

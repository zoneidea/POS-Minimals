import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
const line=z.string().trim().min(1).regex(/^[^\r\n\u0000-\u001f]+$/);
export const contactInput=z.object({name:line.max(100),email:z.email().max(254),subject:line.max(150),message:z.string().trim().min(10).max(3000),website:z.string().max(200).optional().default('')}).strict();
export type ContactInput=z.infer<typeof contactInput>;
export interface ContactService{enabled:boolean;send(input:ContactInput,key:string,address:string):Promise<void>}
// Shared limits apply across Vercel instances; no message or raw IP is stored.
export const CONTACT_LIMIT="local a=tonumber(redis.call('GET',KEYS[1]) or '0'); local b=tonumber(redis.call('GET',KEYS[2]) or '0'); if a>=5 or b>=100 then return 0 end; redis.call('INCR',KEYS[1]); if a==0 then redis.call('EXPIRE',KEYS[1],600) end; redis.call('INCR',KEYS[2]); if b==0 then redis.call('EXPIRE',KEYS[2],86400) end; return 1";
type DeliveryDiagnostic={event:'contact_delivery_rejected';status:number;reason:'sender_unverified'|'key_invalid'|'recipient_restricted'|'quota'|'provider_rejected'};
export function createContactService(env:NodeJS.ProcessEnv=process.env,transport:typeof fetch=fetch,report:(entry:DeliveryDiagnostic)=>void=entry=>{process.stderr.write(JSON.stringify(entry)+'\n');}):ContactService{
 const apiKey=env.RESEND_API_KEY,from=env.CONTACT_EMAIL_FROM,redis=env.UPSTASH_REDIS_REST_URL,redisToken=env.UPSTASH_REDIS_REST_TOKEN,salt=env.SALE_SNAPSHOT_KEY;
 const valid=(v:string|undefined)=>!!v&&v!=='[SENSITIVE]';
 const enabled=[apiKey,from,redis,redisToken,salt].every(valid)&&/^https:\/\/[^/]+\/?$/.test(redis??'');
 return {enabled,async send(input,key,address){
  if(!enabled)throw new ApiError(503,'SERVICE_UNAVAILABLE','ช่องทางส่งข้อความยังไม่พร้อม กรุณาติดต่อ dev@zoneidea.co.th');
  if(input.website)throw new ApiError(400,'VALIDATION_ERROR','ไม่สามารถส่งข้อความนี้ได้');
  const namespace=createHmac('sha256',salt!).update('contact:'+String(env.VERCEL_ENV??'local')).digest('hex');
  const client=createHmac('sha256',salt!).update('contact-ip:'+address).digest('hex');
  try{
   const limited=await transport(redis!,{method:'POST',headers:{Authorization:`Bearer ${redisToken}`,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',CONTACT_LIMIT,2,`contact:${namespace}:${client}`,`contact:${namespace}:global`]),signal:AbortSignal.timeout(3000)});
   const body=await limited.json() as {result?:unknown;error?:unknown};
   if(!limited.ok||body.error||![0,1].includes(body.result as number))throw new Error('Invalid limit response');
   if(body.result===0)throw new ApiError(429,'RATE_LIMITED','ส่งข้อความเกินจำนวนที่กำหนด กรุณารอสักครู่หรือติดต่อทางอีเมล');
  }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(503,'SERVICE_UNAVAILABLE','ช่องทางส่งข้อความไม่พร้อมชั่วคราว กรุณาติดต่อทางอีเมล');}
  try{
   const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`contact/${key}`},body:JSON.stringify({from,to:['dev@zoneidea.co.th'],reply_to:input.email,subject:`[POSJung] ${input.subject}`,text:`ชื่อผู้ติดต่อ: ${input.name}\nอีเมล: ${input.email}\n\n${input.message}`}),signal:AbortSignal.timeout(10000)});
   const body=await response.json() as {id?:unknown;message?:unknown};
   if(!response.ok||typeof body.id!=='string'||!body.id){
    const message=typeof body.message==='string'?body.message:'';
    const reason:DeliveryDiagnostic['reason']=/domain.*not verified/i.test(message)?'sender_unverified':/api key.*(invalid|not active|suspended)|missing api key/i.test(message)?'key_invalid':/only send testing emails/i.test(message)?'recipient_restricted':/quota|rate limit/i.test(message)?'quota':'provider_rejected';
    report({event:'contact_delivery_rejected',status:response.status,reason});throw new Error('Mail not acknowledged');
   }
  }catch{throw new ApiError(502,'CONTACT_SEND_UNCONFIRMED','ยังยืนยันการส่งข้อความไม่ได้ กรุณาลองส่งข้อความเดิมอีกครั้งหรือติดต่อทางอีเมล');}
 }};
}

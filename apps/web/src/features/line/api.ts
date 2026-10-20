import {createClient} from '@supabase/supabase-js';
import {userContextSchema} from '../../../../../packages/contracts/src/index';
import {z} from 'zod';
import {lineCatalog,lineCategories,lineQuote,lineCompletedSale,lineSales,type LineSaleInput} from './schema';
import {recordLineEvent} from './diagnostics';
import {lineAuthKeys,selectedLineAuthKey,browserLineStorage} from './auth-storage';
export const lineStorageKeys=lineAuthKeys(import.meta.env.VITE_SUPABASE_URL);
export const lineAuthStorageKey=selectedLineAuthKey(lineStorageKeys,browserLineStorage());
// Private by default; explicit same-origin SSO opts this browser into the Web SDK key.
if(lineAuthStorageKey===lineStorageKeys.webKey)try{browserLineStorage()?.removeItem(lineStorageKeys.privateKey);}catch{/* Retry cleanup on the next initialization. */}
export const lineAuth=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:lineAuthStorageKey,detectSessionInUrl:false}});
export class LineApiError extends Error{constructor(message:string,readonly status:number,readonly code?:string){super(message);}}
export async function lineRequest(path:string,options:{token?:string;body?:unknown;method?:'GET'|'POST';key?:string;signal?:AbortSignal}={}){
 let token=options.token;
 if(!token){const {data,error}=await lineAuth.auth.getSession();if(error)throw error;if(!data.session)throw new LineApiError('กรุณาเข้าสู่ระบบอีกครั้ง',401);token=data.session.access_token;}
 const requestId=crypto.randomUUID(),started=performance.now(),route=path.split('?')[0]!.replace(/\/by-idempotency-key\/[^/]+/,'/by-idempotency-key/:key').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,':id');
 try{
 const response=await fetch(`/api/v1${path}`,{method:options.method??(options.body?'POST':'GET'),signal:options.signal,headers:{Authorization:`Bearer ${token}`,'X-Request-ID':requestId,'X-Client-Platform':'WEB',...(options.body?{'Content-Type':'application/json'}:{}),...(options.key?{'Idempotency-Key':options.key}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});
 recordLineEvent({event:'API_RESPONSE',route,status:response.status,durationMs:Math.round(performance.now()-started),requestId});
 const result=await response.json();if(!response.ok){if(result.error?.code==='SESSION_DAY_EXPIRED')window.dispatchEvent(new Event('kidtang:line:session-expired'));throw new LineApiError(result.error?.message??'ไม่สามารถโหลดข้อมูลได้',response.status,result.error?.code);}return result.data;
 }catch(error){if(!(error instanceof LineApiError))recordLineEvent({event:'API_UNAVAILABLE',route,requestId});throw error;}
}
export const lineApi={
 identity:async(token:string,signal?:AbortSignal)=>userContextSchema.parse(await lineRequest('/auth/me',{token,signal})),
 policy:async(token:string,signal?:AbortSignal)=>z.object({expiresAt:z.iso.datetime({offset:true})}).parse(await lineRequest('/auth/session-policy',{token,signal})),
 catalog:async(page:number,search:string,barcode:string,signal?:AbortSignal,categoryId?:string)=>{const q=new URLSearchParams({page:String(page),limit:'10'});if(search)q.set('search',search);if(barcode)q.set('barcode',barcode);if(categoryId)q.set('categoryId',categoryId);return lineCatalog.parse(await lineRequest(`/products?${q}`,{signal}));},
 categories:async(page:number,signal?:AbortSignal)=>lineCategories.parse(await lineRequest(`/categories?page=${page}&limit=10`,{signal})),
 entitlements:async(signal?:AbortSignal)=>z.object({coupons:z.boolean()}).parse(await lineRequest('/marketplace/entitlements',{signal})),
 quote:async(body:unknown,signal?:AbortSignal)=>lineQuote.parse(await lineRequest('/sales/quote',{body,signal})),
 commit:async(input:LineSaleInput,key:string)=>lineCompletedSale.parse(await lineRequest('/sales',{body:input,key})),
 recover:async(key:string)=>lineCompletedSale.parse(await lineRequest(`/sales/by-idempotency-key/${key}`)),
 sales:async(page:number,signal?:AbortSignal)=>lineSales.parse(await lineRequest(`/sales?page=${page}`,{signal})),
 receipt:async(id:string,signal?:AbortSignal)=>z.object({status:z.enum(['COMPLETED','VOIDED']),sale:lineCompletedSale}).parse(await lineRequest(`/sales/${id}/receipt`,{signal})),
};
export function lineMessage(error:unknown){if(error instanceof LineApiError)return error.message;const code=(error as {code?:string})?.code;if(code==='invalid_credentials')return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';if(code==='email_not_confirmed')return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';return 'ไม่สามารถดำเนินการได้ กรุณาตรวจสอบการเชื่อมต่อ';}

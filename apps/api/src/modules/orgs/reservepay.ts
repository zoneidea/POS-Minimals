import {readProviderError,type ProviderDiagnostic} from './reservepay-diagnostic.js';
import { createClient } from '@supabase/supabase-js';
export type ReservePayStatus='PENDING'|'SENT'|'FAILED'|'UNKNOWN'|'NOT_CONFIGURED';
export type StoreContact={orgId:string;email:string;phone:string;storeName:string};
export interface ContactLedger {
 claim(orgId:string,requestId:string):Promise<{claimed:boolean;status:ReservePayStatus}>;
 finish(orgId:string,status:'SENT'|'FAILED'|'UNKNOWN',httpStatus?:number,diagnostic?:ProviderDiagnostic):Promise<void>;
}
export function contactLedger(url:string,secret:string):ContactLedger {
 const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {
 async claim(orgId,requestId){const {error}=await client.from('reservepay_contacts').insert({org_id:orgId,request_id:requestId,state:'PENDING'});
  if(!error)return {claimed:true,status:'PENDING'};
  if(error.code!=='23505')throw new Error('Contact ledger unavailable');
  const result=await client.from('reservepay_contacts').select('state').eq('org_id',orgId).single();if(result.error)throw new Error('Contact ledger unavailable');
  return {claimed:false,status:result.data.state as ReservePayStatus};
 },
 async finish(orgId,state,httpStatus,diagnostic){const {error}=await client.from('reservepay_contacts').update({state,http_status:httpStatus??null,diagnostic:diagnostic??null,updated_at:new Date().toISOString()}).eq('org_id',orgId);if(error)throw new Error('Contact ledger unavailable');}
 };
}
export function createContactSync(apiKey:string|undefined,ledger:ContactLedger|undefined,send:typeof fetch=fetch){
 return async(contact:StoreContact,requestId:string):Promise<ReservePayStatus>=>{
  if(!apiKey||!ledger)return 'NOT_CONFIGURED';
  let claim;try{claim=await ledger.claim(contact.orgId,requestId);}catch{return 'UNKNOWN';}
  if(!claim.claimed)return claim.status;
  let state:'SENT'|'FAILED'|'UNKNOWN'='UNKNOWN',httpStatus:number|undefined,diagnostic:ProviderDiagnostic|undefined;
  try{const response=await send('https://api.reservepay.com/merchants/add-contact',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Api-Version':'2025-04-01',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({external_id:contact.orgId,contact_email:contact.email,contact_mobile:contact.phone,contact_name:contact.storeName,favorite:false}),signal:AbortSignal.timeout(8000),redirect:'error'});httpStatus=response.status;state=response.ok?'SENT':'FAILED';if(!response.ok){try{diagnostic=await readProviderError(response,contact,apiKey);}catch{diagnostic={kind:'HTTP_ERROR',messages:['Unable to read response body']};}}else await response.body?.cancel();}catch{state='UNKNOWN';}
  try{await (diagnostic?ledger.finish(contact.orgId,state,httpStatus,diagnostic):ledger.finish(contact.orgId,state,httpStatus));}catch{return 'UNKNOWN';}
  return state;
 };
}
export type ContactSync=ReturnType<typeof createContactSync>;

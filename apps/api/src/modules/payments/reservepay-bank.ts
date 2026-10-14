import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {readProviderError,type ProviderDiagnostic} from '../orgs/reservepay-diagnostic.js';
import type {ReservePayStatus} from '../orgs/reservepay.js';
export type BankLink={orgId:string;bankCode:string;number:string;name:string;version:number};
export interface BankLedger{claim(orgId:string,fingerprint:string,requestId:string):Promise<{claimed:boolean;status:ReservePayStatus}>;finish(orgId:string,fingerprint:string,status:string,httpStatus?:number,diagnostic?:ProviderDiagnostic):Promise<void>;}
export function bankLedger(url:string,secret:string):BankLedger{const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return {
 async claim(orgId,fingerprint,requestId){const {error}=await db.from('reservepay_bank_links').insert({org_id:orgId,fingerprint,state:'PENDING',request_id:requestId});if(!error)return {claimed:true,status:'PENDING'};if(error.code!=='23505')throw new Error('Bank ledger unavailable');const result=await db.from('reservepay_bank_links').select('state').eq('org_id',orgId).eq('fingerprint',fingerprint).single();if(result.error)throw new Error('Bank ledger unavailable');return {claimed:false,status:result.data.state as ReservePayStatus};},
 async finish(orgId,fingerprint,state,httpStatus,diagnostic){const {error}=await db.from('reservepay_bank_links').update({state,http_status:httpStatus??null,diagnostic:diagnostic??null,updated_at:new Date().toISOString()}).eq('org_id',orgId).eq('fingerprint',fingerprint);if(error)throw new Error('Bank ledger unavailable');}
};}
export function createBankSync(apiKey:string|undefined,hashKey:string,ledger:BankLedger|undefined,send:typeof fetch=fetch){return async(input:BankLink,requestId:string):Promise<ReservePayStatus>=>{
 if(!apiKey||!ledger||!hashKey)return 'NOT_CONFIGURED';
 const fingerprint=createHmac('sha256',Buffer.from(hashKey,'hex')).update(JSON.stringify([input.orgId,input.version,input.bankCode,input.number])).digest('hex');
 let claim;try{claim=await ledger.claim(input.orgId,fingerprint,requestId);}catch{return 'UNKNOWN';}if(!claim.claimed)return claim.status;
 let state:'SENT'|'FAILED'|'UNKNOWN'='UNKNOWN',httpStatus:number|undefined,diagnostic:ProviderDiagnostic|undefined;
 try{const response=await send('https://api.reservepay.com/merchants/link-bank-account',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Api-Version':'2025-04-01',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({contact_id:input.orgId,bank_code:input.bankCode,number:input.number,name:input.name,country_code:'TH',primary:true,external_id:input.orgId}),signal:AbortSignal.timeout(8000),redirect:'error'});httpStatus=response.status;state=response.ok?'SENT':'FAILED';if(!response.ok){try{diagnostic=await readProviderError(response,{orgId:input.orgId,email:'',phone:input.number,storeName:input.name},apiKey);}catch{diagnostic={kind:'HTTP_ERROR',messages:['Unable to read response body']};}}else await response.body?.cancel();}catch{state='UNKNOWN';}
 try{await ledger.finish(input.orgId,fingerprint,state,httpStatus,diagnostic);}catch{return 'UNKNOWN';}return state;
};}
export type BankSync=ReturnType<typeof createBankSync>;

import {createHmac} from 'node:crypto';
import {readProviderError,type ProviderDiagnostic} from '../orgs/reservepay-diagnostic.js';
import type {ReservePayStatus} from '../orgs/reservepay.js';
import type {BankLedger} from './reservepay-bank.js';
export function createBankUnlink(apiKey:string|undefined,hashKey:string,ledger:BankLedger|undefined,send:typeof fetch=fetch){return async(orgId:string,version:number,requestId:string):Promise<ReservePayStatus>=>{
 if(!apiKey||!hashKey||!ledger)return 'NOT_CONFIGURED';
 const headers={'Content-Type':'application/json',Accept:'application/json','Api-Version':'2025-04-01',Authorization:`Bearer ${apiKey}`};
 const absentDiagnostic={kind:'VERIFIED_ABSENCE',messages:['Contact and bank account both confirmed absent; local soft deletion permitted']};
 const bothAbsent=async()=>{
  for(const [endpoint,body] of [['retrieve-contact',{contact_id:orgId}],['find-bank-account',{bank_account_id:orgId}]] as const){
   const response=await send(`https://api.reservepay.com/merchants/${endpoint}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error'});
   if(response.status!==400&&response.status!==404){await response.body?.cancel();return false;}
   const detail=await readProviderError(response,{orgId,email:'',phone:'',storeName:''},apiKey);
   if(!detail.messages.includes('NOT_FOUND'))return false;
  }
  return true;
 };
 const fingerprint=createHmac('sha256',Buffer.from(hashKey,'hex')).update(JSON.stringify(['unlink',orgId,version])).digest('hex');
 let claim;try{claim=await ledger.claim(orgId,fingerprint,requestId);}catch{return 'UNKNOWN';}if(!claim.claimed){if(claim.status!=='FAILED')return claim.status;try{if(await bothAbsent()){await ledger.finish(orgId,fingerprint,'SENT',undefined,absentDiagnostic);return 'SENT';}}catch{}return 'FAILED';}
 let state:'SENT'|'FAILED'|'UNKNOWN'='UNKNOWN',httpStatus:number|undefined,diagnostic:ProviderDiagnostic|undefined;
 try{const response=await send('https://api.reservepay.com/merchants/unlink-bank-account',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Api-Version':'2025-04-01',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({contact_id:orgId,bank_account_id:orgId}),signal:AbortSignal.timeout(8000),redirect:'error'});httpStatus=response.status;state=response.ok?'SENT':'FAILED';if(!response.ok){try{diagnostic=await readProviderError(response,{orgId,email:'',phone:'',storeName:''},apiKey);}catch{diagnostic={kind:'HTTP_ERROR',messages:['Unable to read response body']};}}else await response.body?.cancel();if(state==='FAILED'&&diagnostic?.messages.includes('NOT_FOUND')&&await bothAbsent()){state='SENT';httpStatus=undefined;diagnostic=absentDiagnostic;}}catch{state='UNKNOWN';}
 try{await ledger.finish(orgId,fingerprint,state,httpStatus,diagnostic);}catch{return 'UNKNOWN';}return state;
};}
export type BankUnlink=ReturnType<typeof createBankUnlink>;

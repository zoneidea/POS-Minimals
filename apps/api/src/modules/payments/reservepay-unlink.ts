import {createHmac} from 'node:crypto';
import {readProviderError,type ProviderDiagnostic} from '../orgs/reservepay-diagnostic.js';
import type {ReservePayStatus} from '../orgs/reservepay.js';
import type {BankLedger} from './reservepay-bank.js';
export function createBankUnlink(apiKey:string|undefined,hashKey:string,ledger:BankLedger|undefined,send:typeof fetch=fetch){return async(orgId:string,version:number,requestId:string):Promise<ReservePayStatus>=>{
 if(!apiKey||!hashKey||!ledger)return 'NOT_CONFIGURED';
 const fingerprint=createHmac('sha256',Buffer.from(hashKey,'hex')).update(JSON.stringify(['unlink',orgId,version])).digest('hex');
 let claim;try{claim=await ledger.claim(orgId,fingerprint,requestId);}catch{return 'UNKNOWN';}if(!claim.claimed)return claim.status;
 let state:'SENT'|'FAILED'|'UNKNOWN'='UNKNOWN',httpStatus:number|undefined,diagnostic:ProviderDiagnostic|undefined;
 try{const response=await send('https://api.reservepay.com/merchants/unlink-bank-account',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Api-Version':'2025-04-01',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({contact_id:orgId,bank_account_id:orgId}),signal:AbortSignal.timeout(8000),redirect:'error'});httpStatus=response.status;state=response.ok?'SENT':'FAILED';if(!response.ok){try{diagnostic=await readProviderError(response,{orgId,email:'',phone:'',storeName:''},apiKey);}catch{diagnostic={kind:'HTTP_ERROR',messages:['Unable to read response body']};}}else await response.body?.cancel();}catch{state='UNKNOWN';}
 try{await ledger.finish(orgId,fingerprint,state,httpStatus,diagnostic);}catch{return 'UNKNOWN';}return state;
};}
export type BankUnlink=ReturnType<typeof createBankUnlink>;

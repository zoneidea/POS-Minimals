import {useActionError} from '../../lib/use-action-feedback';
import { useRef,useState } from 'react';
import { RequestError,authMessage } from '../../lib/client';
import { createRequestKey } from '../../lib/request-key';
import { commitCashSale,recoverOrRetryCashSale,type CashSaleInput,type CompletedSale } from './checkout-client';
import { pendingSaleKey,pendingSaleSchema,type PendingSale } from './pending-sale';
export function useCashCheckout(scope:string,onSuccess:(sale:CompletedSale)=>void){
 const storageKey=pendingSaleKey(scope),running=useRef(false);
 const [attempt,setAttempt]=useState<PendingSale|null>(()=>{try{const saved=localStorage.getItem(storageKey);return saved?pendingSaleSchema.parse(JSON.parse(saved)):null;}catch{return null;}});
 const [busy,setBusy]=useState(false),[error,setError]=useActionError(),[sale,setSale]=useState<CompletedSale|null>(null);
 const success=async(result:CompletedSale)=>{setSale(result);setAttempt(null);setError('');try{localStorage.removeItem(storageKey);}catch{setError('บันทึกขายสำเร็จ แต่ล้างรหัสรายการในเครื่องไม่ได้ กรุณาจดเลขบิลไว้');}onSuccess(result);};
 const post=async(value:PendingSale)=>{try{await success(await commitCashSale(value.input,value.key));}catch(error){
  if(error instanceof RequestError&&[400,403,409].includes(error.status)){try{localStorage.removeItem(storageKey);}catch{/* Keep the persisted request for recovery if storage removal fails. */}setAttempt(null);}
  setError(authMessage(error));
 }};
 return {attempt,busy,error,sale,
 async submit(input:CashSaleInput){if(running.current||attempt||sale)return;running.current=true;setBusy(true);setError('');const value={key:createRequestKey(),input};try{
  // Persist the immutable request before sending: reload/retry must retain the key.
  localStorage.setItem(storageKey,JSON.stringify(value));setAttempt(value);await post(value);
 }catch{setError('เก็บรหัสคำขอในเครื่องไม่ได้ จึงยังไม่ได้ส่งรายการขาย');}finally{running.current=false;setBusy(false);}},
 async recover(){if(running.current||!attempt||sale)return;running.current=true;setBusy(true);setError('');try{
  try{await success(await recoverOrRetryCashSale(attempt.input,attempt.key));}catch(error){if(error instanceof RequestError&&[400,403,409].includes(error.status)){try{localStorage.removeItem(storageKey);}catch{}setAttempt(null);}setError(authMessage(error));}
 }finally{running.current=false;setBusy(false);}}
 };
}

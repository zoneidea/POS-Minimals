import {useActionError} from '../../lib/use-action-feedback';
import {useRef,useState} from 'react';
import type {z} from 'zod';
import {RequestError,authMessage} from '../../lib/client';
// Preserve the exact version/body/key before any mutation. Retrying after a lost response is safe.
export function useRestaurantAttempt<T,R>(storage:string,schema:z.ZodType<T>,execute:(input:T)=>Promise<R>,onSuccess:(value:R)=>void|Promise<void>){
 const blocked=useRef(false);
 const running=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 const [pending,setPending]=useState<T|null>(()=>{try{const saved=localStorage.getItem(storage);return saved?schema.parse(JSON.parse(saved)):null;}catch{blocked.current=true;return null;}});
 async function submit(input:T){if(running.current||blocked.current)return;running.current=true;setBusy(true);setError('');let committed=false;
 try{const attempt=pending??schema.parse(input);localStorage.setItem(storage,JSON.stringify(attempt));setPending(attempt);const result=await execute(attempt);committed=true;localStorage.removeItem(storage);setPending(null);await onSuccess(result);}
 catch(e){if(!committed&&e instanceof RequestError&&[400,403,404,409].includes(e.status)){try{localStorage.removeItem(storage);}catch{}setPending(null);}setError(committed?'บันทึกแล้ว แต่ปรับหน้าจอไม่สำเร็จ กรุณาตรวจสอบรายการเดิม':authMessage(e));}
 finally{running.current=false;setBusy(false);}}
 return {pending,busy,blocked:blocked.current,error:blocked.current?'อ่านคำขอเดิมในเครื่องไม่ได้ กรุณาตรวจผลรายการขายหรือออเดอร์เดิมก่อนเริ่มใหม่':error,submit};
}

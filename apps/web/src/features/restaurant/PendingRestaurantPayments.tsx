import {useActionError} from '../../lib/use-action-feedback';
import {useState} from 'react';
import {restaurantCashInput} from '@pos/contracts/restaurant';
import {completedSaleSchema} from '../pos/checkout-client';
import {completeCheckout} from '../pos/complete-checkout';
import {call} from '../management/client';
import {RequestError,authMessage} from '../../lib/client';
import {Busy,Notice} from '../../components/Notice';
import {payCash} from './client';
export function pendingRestaurantPayments(scope:string){const prefix=`${scope}:restaurant:cash:`;const result:{storage:string;billId:string;input:ReturnType<typeof restaurantCashInput.parse>|null}[]=[];try{for(let i=0;i<localStorage.length;i++){const storage=localStorage.key(i);if(!storage?.startsWith(prefix))continue;let input=null;try{const parsed=restaurantCashInput.safeParse(JSON.parse(localStorage.getItem(storage)??'null'));if(parsed.success)input=parsed.data;}catch{}result.push({storage,billId:storage.slice(prefix.length),input});}}catch{/* Existing durable requests remain for recovery. */}return result;}
export function PendingRestaurantPayments({scope,onRecovered,onStatus}:{scope:string;onRecovered:()=>void;onStatus:(s:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useActionError();const attempts=pendingRestaurantPayments(scope);
 if(!attempts.length&&!error)return null;
 return <div className="notice"><p>มีคำขอรับเงินที่ยังไม่ยืนยันผล กรุณาตรวจสอบก่อนเริ่มรับเงินรายการใหม่</p>{attempts.map(attempt=><button key={attempt.storage} className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{let sale;try{sale=completedSaleSchema.parse(await call(`/restaurant/bills/${attempt.billId}/settlement`));}catch(e){if(!(e instanceof RequestError)||e.status!==404)throw e;if(!attempt.input)throw new Error('อ่านคำขอเดิมไม่ได้ และยังไม่พบผลรับเงิน กรุณาตรวจสอบรายการขายก่อนทำซ้ำ');sale=await payCash(attempt.billId,attempt.input);}localStorage.removeItem(attempt.storage);await completeCheckout(sale,true,{close:()=>{},clear:onRecovered,status:onStatus});}catch(e){if(e instanceof RequestError&&[400,403,409].includes(e.status)){localStorage.removeItem(attempt.storage);onRecovered();}setError(authMessage(e));}finally{setBusy(false);}}}>{busy?<Busy/>:null}ตรวจสอบผลรับเงิน #{attempt.billId.slice(0,8)}</button>)}{error?<Notice>{error}</Notice>:null}</div>;
}

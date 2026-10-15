import {useEffect,useRef,useState} from 'react';
import {Printer,QrCode,SearchCheck} from 'lucide-react';
import {useActionError} from '../../lib/use-action-feedback';
import {Busy,Notice} from '../../components/Notice';
import {paymentSdk,qrImageSource,paymentStatusLabel,amountMinor} from './reservepay-qr';
import {call} from '../management/client';
import type {GatewayCart} from './gateway-cart';
import {printPaymentQr} from '../printing/print-payment-qr';
export function GatewayQrPayment({amount,onLock,cart}:{amount?:string;onLock:(locked:boolean)=>void;cart:GatewayCart}){
 const [session,setSession]=useState(''),[image,setImage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useActionError(),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [lockedAmount,setLockedAmount]=useState<string>();
 const payable=lockedAmount??amount;
 const active=useRef(true),running=useRef(false),poll=useRef<{abort():void}|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;poll.current?.abort();};},[]);
 useEffect(()=>{
  if(!image||!session)return;
  let cancelled=false,runner:{abort():void}|undefined;
  const timer=window.setTimeout(()=>runner?.abort(),600000);
  void paymentSdk().then(async sdk=>{
   if(cancelled)return;
   const watcher=sdk.createDiscoverNextActionPolling();runner=watcher;
   await watcher.execute({payment_session_id:session,pollingUntilAction:'CHECK_STATUS'});
   const status=await sdk.checkStatus({payment_session_id:session});
   if(!cancelled)setMessage(paymentStatusLabel(status));
  }).catch(()=>{/* Manual status check remains available after polling interruption. */});
  return()=>{cancelled=true;window.clearTimeout(timer);runner?.abort();};
 },[image,session]);
 const run=async(task:()=>Promise<void>)=>{if(running.current)return;running.current=true;setBusy(true);setError('');try{await task();}catch(e){if(active.current)setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}finally{running.current=false;if(active.current)setBusy(false);}};
 const create=()=>run(async()=>{
  if(!payable)return;setLockedAmount(payable);onLock(true);
  const sdk=await paymentSdk();
  if(!active.current)return;
  let id=session;
  if(!id){setUncertain(true);id=await sdk.selectPaymentMethod({amount:amountMinor(payable),currency:'THB',payment_method:'PROMPTPAY'});if(typeof id!=='string'||!id)throw new Error('ไม่ได้รับเลขอ้างอิงการชำระเงิน กรุณาตรวจสอบกับ ReservePay ก่อนสร้างใหม่');if(!active.current)return;setSession(id);setUncertain(false);}
  await call('/payments/gateway/initiate',{...cart,sessionId:id,expectedTotalAmount:payable},'POST');
  if(!active.current)return;
  const polling=sdk.createDiscoverNextActionPolling();poll.current=polling;
  const timer=window.setTimeout(()=>polling.abort(),60000);
  let action:string;try{action=await polling.execute({payment_session_id:id,pollingUntilAction:'DISPLAY_QR'});}finally{window.clearTimeout(timer);poll.current=null;}
  if(!active.current)return;
  if(action!=='DISPLAY_QR'){setMessage(paymentStatusLabel(await sdk.checkStatus({payment_session_id:id})));return;}
  const data=await sdk.retrieveQrData({payment_session_id:id});const source=await qrImageSource(data);if(active.current)setImage(source);
 });
 return <div className="gateway-qr-payment" aria-busy={busy}>
 {error?<Notice>{error}</Notice>:null}
 {uncertain&&!session?<p className="hint">หากส่งคำขอแล้วไม่ทราบผล กรุณาตรวจสอบ ReservePay ก่อนสร้างรายการใหม่</p>:null}
 {session?<p className="gateway-qr-amount">ยอด QRCode ฿{payable}</p>:null}
 {image?<img className="payment-qr" src={image} alt={`QRCode PromptPay ยอด ${payable} บาท`}/>:null}
 {message?<p role="status">{message}</p>:null}
 <div className="gateway-qr-actions">
 {!image?<button className="primary" disabled={busy||!payable||uncertain&&!session} onClick={()=>void create()}>{busy?<Busy/>:<QrCode size={18}/>} {session?'แสดง QRCode รายการเดิม':'สร้าง QRCode'}</button>:null}
 {image?<button className="secondary" disabled={busy} onClick={()=>void run(async()=>{setMessage(await printPaymentQr(image,payable!));})}><Printer size={18}/>พิมพ์ QRCode</button>:null}
 {session?<button className="primary" disabled={busy} onClick={()=>void run(async()=>{const sdk=await paymentSdk(),status=await sdk.checkStatus({payment_session_id:session});if(active.current)setMessage(paymentStatusLabel(status));})}><SearchCheck size={18}/>ตรวจสอบการชำระเงิน</button>:null}
 </div><p className="hint">สร้าง QRCode ยังไม่ตัดสต็อกหรือบันทึกบิลขาย · ปิดหน้าต่างไม่ได้ยกเลิก QRCode ที่ ReservePay</p>
 </div>;
}

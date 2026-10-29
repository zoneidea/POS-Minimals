import {gatewayConfirmation,gatewayLocalDeadline} from './gateway-clock';
import {PrintNotice} from '../printing/PrintNotice';
import {CustomerQrSync} from '../customer-display/CustomerDisplayProvider';
import {completedSaleSchema,type CompletedSale} from '../pos/checkout-client';
import {readGatewayPending,saveGatewayPending,clearGatewayPending,archiveExpiredGateway} from './gateway-pending';
import {useEffect,useRef,useState} from 'react';
import {Printer,QrCode,SearchCheck,XCircle} from 'lucide-react';
import {confirmAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import {Busy,Notice} from '../../components/Notice';
import {paymentSdk,qrImageSource,paymentStatusLabel,amountMinor} from './reservepay-qr';
import {GatewayPollingScope,terminalPaymentStatus} from './gateway-lifecycle';
import {QrExpiryCountdown} from './QrExpiryCountdown';
import {call} from '../management/client';
import {sameGatewayCart,type GatewayCart} from './gateway-cart';
import {printPaymentQr} from '../printing/print-payment-qr';
export function GatewayQrPayment({amount,onLock,cart,scope:storageScope,onCompleted}:{amount?:string;onLock:(locked:boolean)=>void;cart:GatewayCart;scope:string;onCompleted:(sale:CompletedSale,sameCart:boolean)=>void}){
 const [pending,setPending]=useState(()=>readGatewayPending(storageScope));
 const savedCart=pending?.cart??cart;
 const currentCart=useRef(cart);currentCart.current=cart;
 const [session,setSession]=useState(pending?.sessionId??''),[image,setImage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useActionError(),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [lockedAmount,setLockedAmount]=useState<string|undefined>(pending?.amount),[expiresAt,setExpiresAt]=useState<number|null>(null),[status,setStatus]=useState(''),[stopped,setStopped]=useState(false),[deadlinePassed,setDeadlinePassed]=useState(false),[expiryError,setExpiryError]=useState(false),[printMessage,setPrintMessage]=useState(''),[printError,setPrintError]=useState('');
 const payable=lockedAmount??amount;
 const generation=useRef(0),active=useRef(true),running=useRef(false),scope=useRef(new GatewayPollingScope()),currentStatus=useRef('');
 useEffect(()=>{if(pending)onLock(true);active.current=true;scope.current=new GatewayPollingScope();return()=>{active.current=false;scope.current.stop();};},[]);
 const confirmations=useRef<Promise<void>>(Promise.resolve());
 const handleStatus=async(value:string,id=session,force=false)=>{if(!active.current)return;
  if(force||value==='SUCCESSFUL'||terminalPaymentStatus(value)){
   const requestGeneration=generation.current;
   const result=gatewayConfirmation.parse(await call('/payments/gateway/confirm',{sessionId:id},'POST'));
   if(!active.current||requestGeneration!==generation.current)return;
   setExpiresAt(gatewayLocalDeadline(result));setExpiryError(false);value=result.status;
   if(value==='SUCCESSFUL'&&result.sale){const sale=completedSaleSchema.parse(result.sale);clearGatewayPending(storageScope);scope.current.stop();onCompleted(sale,sameGatewayCart(currentCart.current,savedCart));return;}
   if(value==='EXPIRED'){
    archiveExpiredGateway(storageScope,id,payable??pending?.amount??'0.00');
    clearGatewayPending(storageScope);generation.current++;scope.current.stop();scope.current=new GatewayPollingScope();
    setPending(null);setSession('');setImage('');setLockedAmount(undefined);setExpiresAt(null);setDeadlinePassed(false);setStopped(false);setUncertain(false);setPrintMessage('');setPrintError('');currentStatus.current='';setStatus('');
    setMessage('ReservePay ยืนยันว่า QRCode รายการเดิมหมดอายุแล้ว กดสร้าง QRCode เมื่อต้องการชำระใหม่');onLock(false);return;
   }
  }
  currentStatus.current=value;setStatus(value);setMessage(paymentStatusLabel(value));if(terminalPaymentStatus(value))scope.current.stop();
 };
 const acceptStatus=(value:string,id=session,force=false)=>{
  const requestGeneration=generation.current;
  const next=confirmations.current.catch(()=>{}).then(async()=>{
   if(active.current&&requestGeneration===generation.current)await handleStatus(value,id,force);
  });
  confirmations.current=next;return next;
 };
 const refreshExpiry=async(id:string)=>{await acceptStatus('PENDING',id,true);};
 useEffect(()=>{
  if(!image||!session||stopped||deadlinePassed||terminalPaymentStatus(status))return;
  let cancelled=false,runner:{abort():void}|undefined;
  const flow=scope.current;
  const timer=window.setTimeout(()=>runner?.abort(),600000);
  void paymentSdk().then(async sdk=>{
   if(cancelled||!flow.active)return;
   const watcher=sdk.createDiscoverNextActionPolling();runner=watcher;if(!flow.track(watcher))return;
   try{await watcher.execute({payment_session_id:session,pollingUntilAction:'CHECK_STATUS'});
    if(cancelled||!flow.active)return;
    const value=await sdk.checkStatus({payment_session_id:session});if(!cancelled&&flow.active)await acceptStatus(value);
   }finally{flow.release(watcher);}
  }).catch(()=>{if(active.current&&flow.active)setError('ยังยืนยันหรือบันทึกบิลไม่ได้ กรุณากดตรวจสอบการชำระเงินอีกครั้ง');});
  return()=>{cancelled=true;window.clearTimeout(timer);if(runner)flow.release(runner);};
 },[image,session,stopped,deadlinePassed,status]);
 // The signed webhook can settle a bill while SDK polling is delayed or the POS tab regains focus.
 useEffect(()=>{
  if(!image||!session||stopped||deadlinePassed||terminalPaymentStatus(status))return;
  let cancelled=false;
  const check=()=>{if(cancelled||!active.current||running.current)return;running.current=true;void acceptStatus('PENDING',session,true).catch(()=>{}).finally(()=>{running.current=false;});};
  const timer=window.setInterval(check,5000);
  const resume=()=>{if(document.visibilityState==='visible')check();};
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',resume);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',resume);};
 },[image,session,stopped,deadlinePassed,status]);
 const run=async(task:()=>Promise<void>,ignoreStopped=false,printing=false)=>{if(running.current)return;running.current=true;setBusy(true);if(printing)setPrintError('');else setError('');try{await task();}catch(e){if(active.current&&(!ignoreStopped||scope.current.active))(printing?setPrintError:setError)(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}finally{running.current=false;if(active.current)setBusy(false);}};
 const create=()=>run(async()=>{
  const flow=scope.current;
  if(!payable||!flow.active)return;setLockedAmount(payable);onLock(true);
  const sdk=await paymentSdk();if(!active.current||!flow.active)return;
  let id=session;
  if(!id){setUncertain(true);id=await sdk.selectPaymentMethod({amount:amountMinor(payable),currency:'THB',payment_method:'PROMPTPAY'});if(typeof id!=='string'||!id)throw new Error('ไม่ได้รับเลขอ้างอิงการชำระเงิน กรุณาตรวจสอบกับ ReservePay ก่อนสร้างใหม่');if(!active.current)return;setSession(id);setUncertain(false);saveGatewayPending(storageScope,{sessionId:id,amount:payable,cart:savedCart});setPending({sessionId:id,amount:payable,cart:savedCart});if(!flow.active)return;}
  await call('/payments/gateway/initiate',{...savedCart,sessionId:id,expectedTotalAmount:payable},'POST');if(!active.current||!flow.active)return;
  const polling=sdk.createDiscoverNextActionPolling();if(!flow.track(polling))return;
  const timer=window.setTimeout(()=>polling.abort(),60000);
  let action:string;try{action=await polling.execute({payment_session_id:id,pollingUntilAction:'DISPLAY_QR'});}finally{window.clearTimeout(timer);flow.release(polling);}
  if(!active.current||!flow.active)return;
  if(action!=='DISPLAY_QR'){await acceptStatus(await sdk.checkStatus({payment_session_id:id}),id);return;}
  await refreshExpiry(id);if(!active.current||!flow.active||terminalPaymentStatus(currentStatus.current))return;
  const data=await sdk.retrieveQrData({payment_session_id:id});const source=await qrImageSource(data);if(active.current&&flow.active)setImage(source);
 },true);
 useEffect(()=>{
  if(!deadlinePassed||!session||terminalPaymentStatus(status))return;
  let cancelled=false;
  const check=()=>{if(cancelled||!active.current||running.current)return;running.current=true;setBusy(true);void acceptStatus('PENDING',session,true).catch(()=>{if(active.current)setExpiryError(true);}).finally(()=>{running.current=false;if(active.current)setBusy(false);});};
  check();const timer=window.setInterval(check,5000);
  const resume=()=>{if(document.visibilityState==='visible')check();};
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',resume);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',resume);};
 },[deadlinePassed,session,status]);
 const cancel=async()=>{
  if(!await confirmAlert('ยกเลิกการรอชำระเงินหรือไม่?'))return;
  if(!active.current||terminalPaymentStatus(currentStatus.current))return;scope.current.stop();setStopped(true);setMessage('ยกเลิกการรอชำระเงินแล้ว · หยุดตรวจสอบอัตโนมัติ แต่ QRCode ที่ออกแล้วยังอาจชำระได้');
 };
 const showQr=Boolean(image&&!stopped&&!deadlinePassed&&!terminalPaymentStatus(status));
 return <div className="gateway-qr-payment" aria-busy={busy}>
 <CustomerQrSync value={showQr&&expiresAt!==null&&payable&&sameGatewayCart(cart,savedCart)?{image,amount:payable,mode:'GATEWAY',expiresAt}:null}/>
 {pending&&JSON.stringify(cart)!==JSON.stringify(savedCart)?<Notice>มีรายการชำระเงินเดิมรอตรวจสอบ กรุณาตรวจสอบรายการเดิมก่อนรับเงินใหม่ ตะกร้าปัจจุบันจะคงอยู่</Notice>:null}
 {error?<Notice>{error}</Notice>:null}{printError?<PrintNotice message={printError}/>:null}
 {uncertain&&!session?<p className="hint">หากส่งคำขอแล้วไม่ทราบผล กรุณาตรวจสอบ ReservePay ก่อนสร้างรายการใหม่</p>:null}
 {session?<><p className="gateway-qr-amount">ยอด QRCode ฿{payable}</p><QrExpiryCountdown expiresAt={expiresAt} enabled={!terminalPaymentStatus(status)} onExpire={()=>{scope.current.stop();setDeadlinePassed(true);setMessage('กำลังตรวจสอบการหมดอายุกับ ReservePay กรุณารอก่อนสร้างรายการใหม่');}}/>{expiryError?<p className="hint">ยังตรวจสอบรายการกับ ReservePay ไม่สำเร็จ กดตรวจสอบการชำระเงินเพื่อลองอีกครั้ง</p>:null}</>:null}
 {showQr?<img className="payment-qr" src={image} alt={`QRCode PromptPay ยอด ${payable} บาท`}/>:null}
 {message?<p role="status">{message}</p>:null}{printMessage?<p role="status">{printMessage}</p>:null}
 <div className="gateway-qr-actions">
 {!image&&!stopped&&!deadlinePassed&&!terminalPaymentStatus(status)?<button className="primary" disabled={busy||!payable||uncertain&&!session} onClick={()=>void create()}>{busy?<Busy/>:<QrCode size={18}/>} {session?'แสดง QRCode รายการเดิม':'สร้าง QRCode'}</button>:null}
 {showQr?<button className="secondary" disabled={busy} onClick={()=>void run(async()=>{setPrintMessage(await printPaymentQr(image,payable!));},false,true)}><Printer size={18}/>พิมพ์ QRCode</button>:null}
 {(session||busy||uncertain)&&!stopped&&!deadlinePassed&&!terminalPaymentStatus(status)?<button className="secondary danger" onClick={()=>void cancel()}><XCircle size={18}/>ยกเลิกการชำระเงิน</button>:null}
 {session?<button className="primary" disabled={busy} onClick={()=>void run(async()=>{await acceptStatus('PENDING',session,true);})}><SearchCheck size={18}/>ตรวจสอบการชำระเงิน</button>:null}
 </div></div>;
}

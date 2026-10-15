import {useEffect,useRef,useState} from 'react';
import {Clock3} from 'lucide-react';
import {qrSecondsLeft,qrTimeLabel} from './gateway-lifecycle';
export function QrExpiryCountdown({expiresAt,enabled,onExpire}:{expiresAt:number|null;enabled:boolean;onExpire:()=>void}){
 const [now,setNow]=useState(Date.now),callback=useRef(onExpire);callback.current=onExpire;
 useEffect(()=>{
  if(!enabled||expiresAt===null)return;
  let fired=false;
  const tick=()=>{const time=Date.now();setNow(time);if(!fired&&time>=expiresAt){fired=true;window.clearInterval(timer);callback.current();}};
  const timer=window.setInterval(tick,1000);
  const visible=()=>{if(document.visibilityState==='visible')tick();};
  window.addEventListener('focus',tick);document.addEventListener('visibilitychange',visible);tick();
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',visible);};
 },[expiresAt,enabled]);
 if(!enabled)return null;
 const seconds=expiresAt===null?null:qrSecondsLeft(expiresAt,now);
 return <p className="qr-expiry" data-urgent={seconds!==null&&seconds<=60}><Clock3 size={17}/>{seconds===null?'ReservePay ยังไม่ระบุเวลาหมดอายุ':<>QRCode หมดอายุใน <strong role="timer" aria-label="เวลาที่เหลือของ QRCode">{qrTimeLabel(seconds)}</strong></>}</p>;
}

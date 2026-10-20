import {useEffect,useRef,useState} from 'react';
import {ExternalLink} from 'lucide-react';
import type {UserContext} from '../../../../../packages/contracts/src/index';
export function LineOpenWebButton({user,onBusy}:{user:UserContext;onBusy?:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const controller=useRef<AbortController|null>(null),running=useRef(false);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{onBusy?.(busy);return()=>onBusy?.(false);},[busy,onBusy]);
 return <><button className="line-secondary" disabled={busy} onClick={async()=>{if(running.current)return;running.current=true;const c=new AbortController();controller.current=c;setBusy(true);setError('');try{const {openLineWebSession}=await import('./open-web');if(!c.signal.aborted)await openLineWebSession(user,c.signal);}catch(e){if(!c.signal.aborted)setError(e instanceof Error&&/^(บัญชี|หมดเวลา|กรุณา|ไม่สามารถ)/.test(e.message)?e.message:'ไม่สามารถเปิดระบบเว็บได้ กรุณาตรวจสอบการเชื่อมต่อหรือพื้นที่จัดเก็บแล้วลองใหม่');}finally{running.current=false;if(!c.signal.aborted)setBusy(false);}}}><ExternalLink size={18}/>{busy?'กำลังเปิดระบบเว็บ':'เปิดระบบเว็บ'}</button>{error?<p className="line-notice" role="alert">{error}</p>:null}</>;
}

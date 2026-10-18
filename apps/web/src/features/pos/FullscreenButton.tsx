import {useEffect,useRef,useState} from 'react';
import {Maximize,Minimize} from 'lucide-react';
import {warningAlert} from '../../lib/alerts';
export function FullscreenButton(){
 const [active,setActive]=useState(false),[supported,setSupported]=useState(false),[busy,setBusy]=useState(false),owned=useRef(false);
 useEffect(()=>{
  setSupported(Boolean(document.fullscreenEnabled&&document.documentElement.requestFullscreen));
  const sync=()=>{setActive(Boolean(document.fullscreenElement));if(!document.fullscreenElement)owned.current=false;};
  sync();document.addEventListener('fullscreenchange',sync);
  return()=>{document.removeEventListener('fullscreenchange',sync);if(owned.current&&document.fullscreenElement===document.documentElement)void document.exitFullscreen().catch(()=>{});};
 },[]);
 const label=active?'ออกจากเต็มจอ':'เปิดเต็มจอ';
 return <button type="button" className="secondary pos-fullscreen" title={supported?label:'เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ'} aria-label={label} aria-pressed={active} disabled={!supported||busy} onClick={async()=>{
  if(busy)return;setBusy(true);
  try{if(document.fullscreenElement)await document.exitFullscreen();else{owned.current=true;await document.documentElement.requestFullscreen();}}
  catch{owned.current=false;await warningAlert('ไม่สามารถเปลี่ยนโหมดเต็มจอได้ กรุณาตรวจสอบว่าเบราว์เซอร์อนุญาตให้เปิดเต็มจอ');}
  finally{setBusy(false);}
 }}>{active?<Minimize size={18} aria-hidden="true"/>:<Maximize size={18} aria-hidden="true"/>}</button>;
}

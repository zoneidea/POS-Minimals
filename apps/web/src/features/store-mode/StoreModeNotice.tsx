import {useEffect,useState} from 'react';
import {Coffee} from 'lucide-react';
import {z} from 'zod';
import {call} from '../management/client';
export function StoreModeNotice(){
 const [mode,setMode]=useState<'RETAIL'|'CAFE'|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();const load=()=>{void call('/settings/store-mode',undefined,undefined,controller.signal).then(v=>{if(!controller.signal.aborted){setMode(z.object({storeMode:z.enum(['RETAIL','CAFE'])}).parse(v).storeMode);setError(false);}}).catch(()=>{if(!controller.signal.aborted)setError(true);});};load();window.addEventListener('focus',load);return()=>{controller.abort();window.removeEventListener('focus',load);};},[]);
 return error?<p role="status">ไม่สามารถโหลดข้อมูลโหมดร้านได้</p>:mode==='CAFE'?<p className="cafe-mode-notice"><Coffee size={18} aria-hidden="true"/><strong>โหมดคาเฟ่</strong> · ออกเลขคิวและพิมพ์ใบเสร็จต่อด้วยใบออเดอร์เตรียมหลังรับเงิน</p>:null;
}

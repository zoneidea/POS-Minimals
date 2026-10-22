import {Coffee} from 'lucide-react';
export function StoreModeNotice({mode,error}:{mode?:'RETAIL'|'CAFE'|'RESTAURANT';error?:string}){return error?<p role="status">{error}</p>:mode==='CAFE'?<p className="cafe-mode-notice"><Coffee size={18} aria-hidden="true"/><strong>โหมดคาเฟ่</strong> · ออกเลขคิวและพิมพ์ใบเสร็จต่อด้วยใบออเดอร์เตรียมหลังรับเงิน</p>:null;}

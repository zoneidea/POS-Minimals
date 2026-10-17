import {useState} from 'react';
import {TicketPercent,X} from 'lucide-react';
import './coupons.css';
export function CouponEntry({code,onApply,busy,discount}:{code:string;onApply:(code:string)=>void;busy:boolean;discount?:string}){
 const [draft,setDraft]=useState(code);
 return <div className="coupon-code-entry"><label htmlFor="checkout-coupon">โค้ดคูปอง</label><div className="coupon-code-controls"><input id="checkout-coupon" value={draft} disabled={busy} maxLength={32} placeholder="กรอกโค้ดคูปอง" onChange={e=>setDraft(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(/^[A-Z0-9_-]{3,32}$/.test(draft.trim())&&!busy)onApply(draft.trim());}}}/><button type="button" className="secondary" disabled={busy||!/^[A-Z0-9_-]{3,32}$/.test(draft.trim())} onClick={()=>onApply(draft.trim())}><TicketPercent size={16}/>ใช้โค้ด</button>{code?<button type="button" className="secondary" aria-label="นำคูปองออก" disabled={busy} onClick={()=>{setDraft('');onApply('');}}><X size={16}/></button>:null}</div>{code?<p className="coupon-applied">โค้ด {code}{discount?` · ส่วนลด ฿${discount}`:' · กำลังตรวจสอบ'}</p>:null}</div>;
}

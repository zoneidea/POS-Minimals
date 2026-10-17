import {useState} from 'react';
import {z} from 'zod';
import {Save} from 'lucide-react';
import {couponInput,type couponSchema} from './schema';
import {Modal} from '../../components/Modal';
import {Notice,Busy} from '../../components/Notice';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {saveCoupon} from './client';
import './coupons.css';
export type Coupon=z.infer<typeof couponSchema>;
export const thaiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function CouponForm({item,onClose,onSaved}:{item?:Coupon;onClose:()=>void;onSaved:()=>void}){
 const [name,setName]=useState(item?.name??''),[code,setCode]=useState(item?.code??''),[amount,setAmount]=useState(item?.amount??'0'),[startsOn,setStartsOn]=useState(item?.startsOn??thaiToday()),[endsOn,setEndsOn]=useState(item?.endsOn??thaiToday()),[maxUses,setMaxUses]=useState(String(item?.maxUses??0)),[showOnReceipt,setShowOnReceipt]=useState(item?.showOnReceipt??false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal title={item?'แก้ไขคูปอง':'เพิ่มคูปอง'} busy={busy} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();if(busy)return;const normalized=/^\d+(\.\d{1,2})?$/.test(amount)?Number(amount).toFixed(2):amount;const parsed=couponInput.safeParse({name,code,amount:normalized,startsOn,endsOn,maxUses:Number(maxUses),showOnReceipt});if(!parsed.success){setError('กรุณากรอกข้อมูลให้ครบ มูลค่าและจำนวนต้องมากกว่า 0 และวันสิ้นสุดไม่ก่อนวันเริ่ม');return;}setBusy(true);try{if(item&&!await confirmAlert('ยืนยันแก้ไขคูปองนี้หรือไม่?'))return;await saveCoupon({...parsed.data,...(item?{version:item.version}:{})},item?.id);await successAlert();onSaved();}catch(err){const msg=authMessage(err);setError(msg);await warningAlert(msg);}finally{setBusy(false);}}}>
 {error?<Notice>{error}</Notice>:null}<fieldset className="coupon-form" disabled={busy}>
 <label>ชื่อคูปอง <span className="required-marker">*</span><input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>โค้ดคูปอง <span className="required-marker">*</span><input required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><small>อักษรอังกฤษ ตัวเลข _ หรือ - จำนวน 3–32 ตัว</small></label>
 <label>มูลค่าส่วนลด (บาท) <span className="required-marker">*</span><input required type="number" min="0.01" step="0.01" max="999999999999.99" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
 <label>จำนวนที่ใช้ได้ทั้งหมด <span className="required-marker">*</span><input required type="number" min={Math.max(1,item?.usedCount??0)} max={2147483647} step="1" value={maxUses} onChange={e=>setMaxUses(e.target.value)}/></label>
 <label>วันที่เริ่ม <span className="required-marker">*</span><input required type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label>
 <label>วันที่สิ้นสุด <span className="required-marker">*</span><input required type="date" min={startsOn} value={endsOn} onChange={e=>setEndsOn(e.target.value)}/></label>
 <label className="coupon-checkbox"><input type="checkbox" checked={showOnReceipt} onChange={e=>setShowOnReceipt(e.target.checked)}/>แสดงโค้ดคูปองท้ายใบเสร็จ</label>
 </fieldset><div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>ยกเลิก</button><button className="primary" disabled={busy}>{busy?<Busy/>:<Save size={18}/>}บันทึก</button></div></form></Modal>;
}

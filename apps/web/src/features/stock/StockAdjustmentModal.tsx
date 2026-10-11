import { useState } from 'react';
import { ArrowRight,ArrowDownUp,Save,FileText } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Field } from '../../components/Field';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import type { Product } from '../products/client';
import { adjustStock } from './client';
export function StockAdjustmentModal({item,onSaved,onCancel}:{item:Product;onSaved:()=>void;onCancel:()=>void}){
 const [delta,setDelta]=useState('0'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [key]=useState(()=>crypto.randomUUID());
 const amount=Number(delta),after=item.quantity+amount;
 const valid=delta.trim()!==''&&Number.isInteger(amount)&&amount!==0&&Math.abs(amount)<=2147483647&&after>=0&&after<=2147483647;
 return <Modal title="ปรับสต็อก" busy={busy} onClose={onCancel}><form className="product-form" onSubmit={async event=>{
  event.preventDefault();if(busy||!valid)return;const reason=String(new FormData(event.currentTarget).get('reason')).trim();if(!reason){setError('กรุณาระบุเหตุผลในการปรับสต็อก');return;}
  setBusy(true);setError('');try{await adjustStock(item.id,amount,reason,item.version,key);onSaved();}catch(error){setError(authMessage(error));}finally{setBusy(false);}
 }}><p className="stock-product"><strong>{item.name}</strong><span>{item.barcode}</span></p><div className="stock-preview"><div><span>จำนวนก่อนปรับ</span><strong>{item.quantity}</strong></div><ArrowRight size={24} aria-hidden="true"/><div><span>จำนวนหลังปรับ</span><strong>{delta.trim()!==''&&Number.isInteger(amount)?after:'—'}</strong></div></div>
 <Field id="stock-delta" name="delta" label="เปลี่ยนแปลงจำนวน (+ เพิ่ม / − ลด)" icon={ArrowDownUp} type="number" step="1" min={-2147483647} max={2147483647} value={delta} onChange={event=>setDelta(event.target.value)} required autoFocus disabled={busy}/>
 <Field id="stock-reason" name="reason" label="เหตุผลในการปรับสต็อก" icon={FileText} maxLength={500} required disabled={busy}/>
 {delta.trim()!==''&&after<0?<Notice>จำนวนหลังปรับต้องไม่ติดลบ กรุณาลดจำนวนให้น้อยลง</Notice>:null}<p className="product-note">ระบบเก็บจำนวนก่อน–หลัง วันเวลา และบัญชีผู้ปรับทุกครั้ง</p>
 {error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>ยกเลิก</button><button className="primary" disabled={busy||!valid}>{busy?<Busy/>:<Save size={18}/>}บันทึกสต็อก</button></div></form></Modal>;
}

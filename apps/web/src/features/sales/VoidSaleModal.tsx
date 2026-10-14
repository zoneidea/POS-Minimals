import {confirmAlert,successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import './sales.css';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { voidSale,type SaleSummary } from './client';
export function VoidSaleModal({sale,onClose,onSaved}:{sale:SaleSummary;onClose:()=>void;onSaved:()=>void}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useActionError(),[attempt,setAttempt]=useState<string|null>(null);
 return <Modal title="ยืนยันยกเลิกการขาย" onClose={onClose} busy={busy}><form className="void-sale-form" onSubmit={async event=>{event.preventDefault();const submitted=attempt??reason.trim();if(!submitted)return;if(!await confirmAlert('ยืนยันยกเลิกการขายและคืนสต็อกหรือไม่?'))return;setAttempt(submitted);setBusy(true);setError('');try{await voidSale(sale.id,submitted);await successAlert('ยกเลิกการขายสำเร็จ');onSaved();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}><p>บิล {sale.saleNo} · ฿{sale.totalAmount}</p><p>คืนสต็อกและเก็บประวัติการยกเลิก การคืนเงินจริงให้ดำเนินการภายนอกระบบ</p><label htmlFor="void-reason">เหตุผลการยกเลิก</label><textarea id="void-reason" maxLength={500} required autoFocus value={reason} disabled={busy||attempt!==null} onChange={event=>setReason(event.target.value)}/>{error?<Notice>{error} สามารถส่งซ้ำด้วยเหตุผลเดิมได้ ระบบจะไม่คืนสต็อกซ้ำ</Notice>:null}<div className="category-actions"><button className="primary" disabled={busy||!reason.trim()}>{busy?<Busy/>:null}{attempt?'ตรวจสอบและยืนยันอีกครั้ง':'ยืนยันยกเลิกการขาย'}</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>ปิด</button></div></form></Modal>;
}

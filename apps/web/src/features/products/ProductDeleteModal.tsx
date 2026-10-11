import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { deleteProduct,type Product } from './client';
export function ProductDeleteModal({item,onDeleted,onCancel}:{item:Product;onDeleted:()=>void;onCancel:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal title="ยืนยันการลบสินค้า" busy={busy} onClose={onCancel}><p>ต้องการลบ “{item.name}” ({item.barcode}) หรือไม่?</p><p>สินค้าจะถูกซ่อนและเก็บประวัติไว้ บาร์โค้ดนี้ไม่สามารถนำกลับมาใช้ซ้ำได้</p>{error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel} autoFocus>ยกเลิก</button><button type="button" className="secondary danger" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await deleteProduct(item);onDeleted();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>{busy?<Busy/>:<Trash2 size={18} aria-hidden="true"/>}ยืนยันลบ</button></div></Modal>;
}

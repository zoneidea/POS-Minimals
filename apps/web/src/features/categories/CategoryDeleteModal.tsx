import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Busy, Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { deleteCategory, type Category } from './client';

export function CategoryDeleteModal({item,onDeleted,onCancel}:{item:Category;onDeleted:()=>void;onCancel:()=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal title="ยืนยันการลบหมวดหมู่" busy={busy} onClose={onCancel}>
  <p>ต้องการลบหมวดหมู่ “{item.name}” หรือไม่?</p>
  <p>หมวดหมู่จะถูกซ่อน โดยยังเก็บข้อมูลและประวัติไว้ หากมีสินค้าที่ใช้งานอยู่ ระบบจะไม่อนุญาตให้ลบ</p>
  {error?<Notice>{error}</Notice>:null}
  <div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel} autoFocus>ยกเลิก</button><button type="button" className="secondary danger" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await deleteCategory(item.id);onDeleted();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>{busy?<Busy/>:<Trash2 size={18} aria-hidden="true"/>}ยืนยันลบ</button></div>
 </Modal>;
}

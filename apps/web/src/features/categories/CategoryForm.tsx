import {confirmAlert,successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { Tags, Save, Plus } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Field } from '../../components/Field';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { saveCategory,type Category } from './client';
export function CategoryForm({item,onSaved,onCancel}:{item?:Category;onSaved:()=>void;onCancel:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useActionError();
 return <Modal title={item?'แก้ไขหมวดหมู่':'เพิ่มหมวดหมู่'} onClose={onCancel} busy={busy}><form className="category-form" onSubmit={async e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')).trim();if(!name){setError('กรุณากรอกชื่อหมวดหมู่');return;}if(item&&!await confirmAlert())return;setBusy(true);setError('');try{await saveCategory(name,item?.id);await successAlert();onSaved();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}><Field id="category-name" name="name" label="ชื่อหมวดหมู่" icon={Tags} maxLength={120} defaultValue={item?.name??''} required autoFocus disabled={busy}/>{error?<Notice>{error}</Notice>:null}<div className="category-actions"><button className="primary" disabled={busy}>{busy?<Busy/>:item?<Save size={18} aria-hidden="true"/>:<Plus size={18} aria-hidden="true"/>}{item?'บันทึก':'เพิ่มหมวดหมู่'}</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}>ยกเลิก</button></div></form></Modal>;
}

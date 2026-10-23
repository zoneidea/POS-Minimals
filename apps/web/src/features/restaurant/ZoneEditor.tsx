import {useId,useState} from 'react';
import {MapPin,Save,Trash2} from 'lucide-react';
import type {RestaurantZone} from '@pos/contracts/restaurant';
import {Field} from '../../components/Field';
import {Modal} from '../../components/Modal';
import {Busy,Notice} from '../../components/Notice';
import {useActionError} from '../../lib/use-action-feedback';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert} from '../../lib/alerts';
import {saveZone,deleteZone} from './client';
export function ZoneEditor({zone,onClose,onSaved}:{zone?:RestaurantZone;onClose:()=>void;onSaved:()=>void}){
 const id=useId(),[name,setName]=useState(zone?.name??''),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 async function mutate(remove=false){if((zone||remove)&&!await confirmAlert(remove?'ลบโซนนี้หรือไม่? โต๊ะในโซนจะย้ายเป็นไม่มีโซน โดยไม่ลบโต๊ะหรือประวัติออเดอร์':'ยืนยันการแก้ไขโซนหรือไม่?'))return;setBusy(true);setError('');try{if(remove&&zone)await deleteZone(zone);else await saveZone(name,zone);await successAlert();onSaved();}catch(e){setError(authMessage(e));}finally{setBusy(false);}}
 return <Modal title={zone?'แก้ไขโซน':'สร้างโซน'} onClose={onClose} busy={busy}><form className="category-form" onSubmit={e=>{e.preventDefault();void mutate();}}><Field id={id} name="zoneName" label="ชื่อโซน" icon={MapPin} required autoFocus maxLength={60} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/>{error?<Notice>{error}</Notice>:null}<div className="restaurant-zone-editor-actions"><button className="primary" disabled={busy||!name.trim()}>{busy?<Busy/>:<Save size={18}/>}บันทึกโซน</button>{zone?<button type="button" className="secondary danger" disabled={busy} onClick={()=>void mutate(true)}><Trash2 size={18}/>ลบโซน</button>:null}<button type="button" className="secondary" disabled={busy} onClick={onClose}>ยกเลิก</button></div></form></Modal>;
}

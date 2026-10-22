import {useActionError} from '../../lib/use-action-feedback';
import {useState} from 'react';
import type {RestaurantTable} from '@pos/contracts/restaurant';
import {restaurantTableInput} from '@pos/contracts/restaurant';
import {Modal} from '../../components/Modal';
import {LabelText} from '../../components/LabelText';
import {Busy,Notice} from '../../components/Notice';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert} from '../../lib/alerts';
import {saveTable} from './client';
export function TableEditor({table,onClose,onSaved}:{table?:RestaurantTable;onClose:()=>void;onSaved:()=>void}){
 const [name,setName]=useState(table?.name??''),[zone,setZone]=useState(table?.zone??''),[seats,setSeats]=useState(String(table?.seats??2)),[enabled,setEnabled]=useState(table?.enabled??true),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 return <Modal title={table?'แก้ไขโต๊ะ':'เพิ่มโต๊ะ'} onClose={onClose} busy={busy}><form className="restaurant-table-form" onSubmit={async e=>{e.preventDefault();const input=restaurantTableInput.safeParse({name,zone,seats:Number(seats),enabled,...(table?{version:table.version}:{})});if(!input.success){setError('กรุณาตรวจสอบชื่อโต๊ะและจำนวนที่นั่ง 1–100 ที่');return;}if(table&&!await confirmAlert())return;setBusy(true);setError('');try{await saveTable(input.data,table);await successAlert();onSaved();}catch(e){setError(authMessage(e));}finally{setBusy(false);}}}>
 <label><LabelText required>ชื่อโต๊ะ</LabelText><input required data-autofocus maxLength={60} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
 <label><LabelText>โซน</LabelText><input maxLength={60} value={zone} disabled={busy} onChange={e=>setZone(e.target.value)} placeholder="เช่น ในร้าน / สวน"/></label>
 <label><LabelText required>จำนวนที่นั่ง</LabelText><input required type="number" min={1} max={100} value={seats} disabled={busy} onChange={e=>setSeats(e.target.value)}/></label>
 <label className="restaurant-checkbox"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)}/>เปิดใช้งานโต๊ะ</label>
 {error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>ยกเลิก</button><button className="primary" disabled={busy}>{busy?<Busy/>:null}บันทึกโต๊ะ</button></div></form></Modal>;
}

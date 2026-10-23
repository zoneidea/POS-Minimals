import {useActionError} from '../../lib/use-action-feedback';
import {useState,useId} from 'react';
import {Armchair,MapPin,Users,Save,Plus} from 'lucide-react';
import {Field} from '../../components/Field';
import type {RestaurantTable,RestaurantZone} from '@pos/contracts/restaurant';
import {restaurantTableInput} from '@pos/contracts/restaurant';
import {Modal} from '../../components/Modal';
import {Busy,Notice} from '../../components/Notice';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert} from '../../lib/alerts';
import {saveTable} from './client';
export function TableEditor({table,onClose,onSaved,zones=[]}:{table?:RestaurantTable;zones?:RestaurantZone[];onClose:()=>void;onSaved:()=>void}){
 const id=useId();
 const [name,setName]=useState(table?.name??''),[zone,setZone]=useState(table?.zone??''),[seats,setSeats]=useState(String(table?.seats??2)),[enabled,setEnabled]=useState(table?.enabled??true),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 return <Modal title={table?'แก้ไขโต๊ะ':'เพิ่มโต๊ะ'} onClose={onClose} busy={busy}><form className="category-form restaurant-table-form" onSubmit={async e=>{e.preventDefault();const input=restaurantTableInput.safeParse({name,zone,seats:Number(seats),enabled,...(table?{version:table.version}:{})});if(!input.success){setError('กรุณาตรวจสอบชื่อโต๊ะและจำนวนที่นั่ง 1–100 ที่');return;}if(table&&!await confirmAlert())return;setBusy(true);setError('');try{await saveTable(input.data,table);await successAlert();onSaved();}catch(e){setError(authMessage(e));}finally{setBusy(false);}}}>
 <Field id={id+'-name'} name="name" label="ชื่อโต๊ะ" icon={Armchair} required autoFocus maxLength={60} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/>
 <Field list={id+'-zones'} id={id+'-zone'} name="zone" label="โซน" icon={MapPin} maxLength={60} value={zone} disabled={busy} onChange={e=>setZone(e.target.value)} placeholder="เลือกหรือระบุโซน"/><datalist id={id+'-zones'}>{zones.map(z=><option value={z.name} key={z.id}/>)}</datalist>
 <Field id={id+'-seats'} name="seats" label="จำนวนที่นั่ง" icon={Users} required type="number" min={1} max={100} value={seats} disabled={busy} onChange={e=>setSeats(e.target.value)}/>
 <label className="settings-checkbox restaurant-checkbox"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)}/>เปิดใช้งานโต๊ะ</label>
 {error?<Notice>{error}</Notice>:null}<div className="category-actions"><button className="primary" disabled={busy}>{busy?<Busy/>:table?<Save size={18}/>:<Plus size={18}/>}บันทึกโต๊ะ</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>ยกเลิก</button></div></form></Modal>;
}

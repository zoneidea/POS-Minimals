import {useState} from 'react';
import {Pencil,Trash2,Power,PowerOff} from 'lucide-react';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {Busy} from '../../components/Notice';
import {authMessage} from '../../lib/client';
import {call,type Member} from './client';
export function MemberActions({item,disabled,onEdit,onDelete,onChanged}:{item:Member;disabled:boolean;onEdit:()=>void;onDelete:()=>void;onChanged:()=>void}){
 const [busy,setBusy]=useState(false);
 if(item.role==='OWNER')return <span>เจ้าของร้านได้รับการป้องกัน</span>;
 const active=item.status==='ACTIVE',pending=item.status==='INVITED';
 const toggle=async()=>{
  if(busy||disabled||pending)return;
  setBusy(true);
  try{
   if(!await confirmAlert(`${active?'ปิด':'เปิด'}ใช้งาน “${item.alias}” หรือไม่?${active?' สมาชิกจะไม่สามารถเข้าถึงข้อมูลร้านได้':''}`))return;
   await call(`/users/${item.id}`,{role:item.role,status:active?'SUSPENDED':'ACTIVE',version:item.version},'PATCH');
   await successAlert(active?'ปิดใช้งานสมาชิกแล้ว':'เปิดใช้งานสมาชิกแล้ว');onChanged();
  }catch(error){await warningAlert(authMessage(error));onChanged();}finally{setBusy(false);}
 };
 return <div className="staff-actions"><button type="button" className="secondary" disabled={disabled||busy||pending} aria-label={`แก้ไข ${item.alias}`} title={pending?'รอสมาชิกตอบรับคำเชิญก่อนแก้ไขสิทธิ์':'แก้ไขสิทธิ์'} onClick={onEdit}><Pencil size={18}/></button>
 {!pending?<button type="button" className={`secondary${active?' danger':''}`} disabled={disabled||busy} aria-label={`${active?'ปิด':'เปิด'}ใช้งาน ${item.alias}`} onClick={()=>void toggle()}>{busy?<Busy/>:active?<PowerOff size={18}/>:<Power size={18}/>}<span>{active?'ปิดใช้งาน':'เปิดใช้งาน'}</span></button>:null}
 <button type="button" className="secondary danger" disabled={disabled||busy} aria-label={`ลบ ${item.alias}`} title="ลบสมาชิกออกจากร้าน" onClick={onDelete}><Trash2 size={18}/></button></div>;
}

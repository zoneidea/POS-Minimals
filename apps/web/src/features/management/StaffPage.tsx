import { useEffect,useState } from 'react';
import { UserPlus } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Busy,Notice } from '../../components/Notice';
import { getMembers,type Member } from './client';
import {MemberActions} from './MemberActions';
import { MemberModal } from './MemberModal';
import { InviteModal } from './InviteModal';
import './management.css';
export function StaffPage({canManage=false}:{canManage?:boolean}){const [items,setItems]=useState<Member[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<{item:Member;remove:boolean}|null>(null),[invite,setInvite]=useState(false);
 useEffect(()=>{if(!canManage){setLoading(false);return;}const c=new AbortController();setLoading(true);setError('');getMembers(page,c.signal).then(value=>{if(!c.signal.aborted){setItems(value.items);setTotal(value.total);}}).catch(error=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[page,revision,canManage]);
 if(!canManage)return <Notice>เฉพาะเจ้าของร้านเท่านั้น</Notice>;
 const saved=()=>{setSelected(null);setInvite(false);setRevision(v=>v+1);};return <><div className="category-actions staff-toolbar"><button className="primary" onClick={()=>setInvite(true)}><UserPlus size={18}/>เชิญสมาชิก</button></div>{loading?<p role="status"><Busy/>กำลังโหลดสมาชิก</p>:null}{error?<Notice>{error}</Notice>:null}{<DataTable error={Boolean(error)} loading={loading} label="สมาชิกในร้าน" rows={items} total={total} page={page} onPageChange={setPage} disabled={loading} rowKey={item=>item.id} columns={[{key:'name',header:'ชื่อที่ใช้แสดง',render:item=>item.alias},{key:'role',header:'สิทธิ์',render:item=>({OWNER:'เจ้าของร้าน',EMPLOYEE:'พนักงานขาย',ACCOUNTANT:'บัญชี'})[item.role]},{key:'status',header:'สถานะ',render:item=>({ACTIVE:'ใช้งาน',INVITED:'รอตอบรับ',SUSPENDED:'ปิดใช้งาน'})[item.status]},{key:'actions',header:'จัดการ',render:item=><MemberActions item={item} disabled={loading} onEdit={()=>setSelected({item,remove:false})} onDelete={()=>setSelected({item,remove:true})} onChanged={()=>setRevision(v=>v+1)}/>}]}/>}{selected?<MemberModal {...selected} onClose={()=>setSelected(null)} onSaved={saved}/>:null}{invite?<InviteModal onClose={()=>setInvite(false)} onSaved={saved}/>:null}</>;
}

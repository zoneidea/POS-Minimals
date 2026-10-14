import {useEffect,useState} from 'react';
import {DataTable} from '../../components/DataTable';
import {Notice} from '../../components/Notice';
import {actionLabels,listActivities,type Activity} from './client';
const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'});
export function ActivityHistory(){
 const [items,setItems]=useState<Activity[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[action,setAction]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError(false);listActivities(page,action,c.signal).then(data=>{if(!c.signal.aborted){setItems(data.items);setTotal(data.total);}}).catch(()=>{if(!c.signal.aborted)setError(true);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[page,action]);
 return <section className="activity-history" aria-label="ประวัติกิจกรรม"><label className="field"><span>ประเภทกิจกรรม</span><div className="input-wrap"><select aria-label="ประเภทกิจกรรม" value={action} onChange={event=>{setAction(event.target.value);setPage(1);}}><option value="">ทั้งหมด</option>{Object.entries(actionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div></label><p className="product-note">กิจกรรมย้อนหลัง 30 วัน · เวลาไทย</p>{error?<Notice>ไม่สามารถโหลดข้อมูลได้</Notice>:null}<DataTable label="ประวัติกิจกรรม" rows={items} total={total} page={page} onPageChange={setPage} rowKey={row=>row.id} loading={loading} error={error} columns={[
 {key:'date',header:'วันเวลา',render:row=>date.format(new Date(row.createdAt))},
 {key:'action',header:'กิจกรรม',render:row=>actionLabels[row.action]??row.action},
 {key:'actor',header:'ผู้ดำเนินการ',render:row=>row.actorUsername??'บัญชีผู้ใช้'},
 {key:'entity',header:'รหัสรายการ',render:row=><span className="actor-id">{row.entityId}</span>},
 {key:'request',header:'รหัสคำขอ',render:row=><span className="actor-id">{row.requestId}</span>}
 ]}/></section>;
}

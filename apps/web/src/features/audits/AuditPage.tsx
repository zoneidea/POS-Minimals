import {useState} from 'react';
import {StockHistory} from '../stock/StockHistory';
import {ActivityHistory} from './ActivityHistory';
export function AuditPage(){const [tab,setTab]=useState<'activity'|'stock'>('activity');return <><div className="audit-toolbar" role="group" aria-label="ประเภทประวัติ"><button className="secondary" aria-pressed={tab==='activity'} onClick={()=>setTab('activity')}>กิจกรรมร้าน</button><button className="secondary" aria-pressed={tab==='stock'} onClick={()=>setTab('stock')}>ประวัติสต็อก</button></div>{tab==='activity'?<ActivityHistory/>:<StockHistory/>}</>;}

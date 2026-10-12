import { useEffect,useState } from 'react';
import { Banknote,ReceiptText,Undo2,Package,RefreshCw } from 'lucide-react';
import type { z } from 'zod';
import { dashboardResult } from './schema';
import { getDashboard,displayMoney } from './client';
import { MetricCards } from './MetricCards';
import { DashboardTopProducts } from './DashboardTopProducts';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import './reports.css';
export function DashboardPage(){const [data,setData]=useState<z.infer<typeof dashboardResult>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');getDashboard(c.signal).then(value=>{if(!c.signal.aborted)setData(value);}).catch(error=>{if(!c.signal.aborted)setError(authMessage(error));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision]);
 return <><div className="report-toolbar"><p className="report-note">สรุปวันนี้และเดือนปัจจุบันตามเวลาไทย · ไม่นับบิลยกเลิกในยอดขายสุทธิ</p><button className="secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/>โหลดใหม่</button></div>{loading?<p role="status"><Busy/>กำลังโหลด Dashboard</p>:null}{error?<Notice>{error}</Notice>:null}{data&&!error?<><p className="report-note">วันที่ {data.dateBangkok}</p><MetricCards items={[{label:'ยอดขายวันนี้',value:`฿${displayMoney(data.todaySales)}`,icon:Banknote},{label:'ยอดขายเดือนนี้',value:`฿${displayMoney(data.monthSales)}`,icon:Banknote},{label:'บิลสำเร็จวันนี้',value:String(data.todayBills),icon:ReceiptText},{label:'บิลขายวันนี้ที่ยกเลิก',value:String(data.todayVoids),icon:Undo2},{label:'สินค้าใกล้หมด',value:String(data.lowStockCount),icon:Package},{label:'ยอดขายเงินสดวันนี้',value:`฿${displayMoney(data.cashToday)}`,icon:Banknote},{label:'ยอดขาย PromptPay วันนี้',value:`฿${displayMoney(data.promptpayToday)}`,icon:Banknote,detail:'การชำระ PromptPay ยังอยู่ระหว่างพัฒนา'}]}/><DashboardTopProducts items={data.topProducts}/><nav className="staff-actions" aria-label="ทางลัด Dashboard"><a className="primary" href="/pos">ขายสินค้า</a><a className="secondary" href="/reports">ดูรายงาน</a><a className="secondary" href="/inventory">คลังสินค้า</a></nav></>:null}</>;
}

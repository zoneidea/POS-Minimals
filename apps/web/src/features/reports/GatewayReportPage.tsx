import {LabelText} from '../../components/LabelText';
import {useEffect,useState} from 'react';
import {CalendarDays,Banknote,Percent,Wallet} from 'lucide-react';
import {gatewayReportResult,type GatewayReport} from './gateway-schema';
import {DataTable} from '../../components/DataTable';
import {Busy,Notice} from '../../components/Notice';
import {call} from '../management/client';
import {getPaymentConfig} from '../payments/client';
import {MetricCards} from './MetricCards';
import {displayMoney} from './client';
import './reports.css';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
export function GatewayReportPage(){
 const [draft,setDraft]=useState({from:today(),to:today()}),[query,setQuery]=useState({...draft,page:1}),[data,setData]=useState<GatewayReport|null>(null),[loading,setLoading]=useState(true),[enabled,setEnabled]=useState<boolean|null>(null),[error,setError]=useState(''),[filterError,setFilterError]=useState('');
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');setData(null);void getPaymentConfig(c.signal).then(async config=>{if(c.signal.aborted)return;setEnabled(config.mode==='GATEWAY');if(config.mode!=='GATEWAY')return;const result=await call(`/reports/gateway?${new URLSearchParams({from:query.from,to:query.to,page:String(query.page)})}`,undefined,undefined,c.signal);if(!c.signal.aborted)setData(gatewayReportResult.parse(result));}).catch(()=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[query]);
 if(enabled===false)return <Notice>ร้านไม่ได้เปิด Payment Gateway</Notice>;
 return <><div className="report-filters"><form onSubmit={e=>{e.preventDefault();const days=(Date.parse(draft.to)-Date.parse(draft.from))/86400000;if(!Number.isFinite(days)||days<0||days>=366){setFilterError('เลือกช่วงวันที่เรียงตามลำดับและไม่เกิน 366 วัน');return;}setFilterError('');setQuery({...draft,page:1});}}><label><LabelText required>จากวันที่</LabelText><input type="date" required value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label><label><LabelText required>ถึงวันที่</LabelText><input type="date" required value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label><button className="primary" disabled={loading}><CalendarDays size={16}/>แสดงรายงาน</button></form></div>{filterError?<Notice>{filterError}</Notice>:null}{error?<Notice>{error}</Notice>:null}{loading?<p role="status"><Busy/>กำลังโหลดรายงาน Gateway</p>:null}
 <MetricCards unavailable={!data||loading||Boolean(error)} items={[{label:'ยอดก่อนหักค่าธรรมเนียม',value:`฿${displayMoney(data?.summary.gross??'0.00')}`,icon:Banknote},{label:'ค่าธรรมเนียมรวม (1.5%)',value:`฿${displayMoney(data?.summary.fees??'0.00')}`,icon:Percent},{label:'ยอดรับสุทธิรวม',value:`฿${displayMoney(data?.summary.net??'0.00')}`,icon:Wallet}]}/>
 <DataTable label="รายการขาย Payment Gateway" rows={data?.items??[]} total={data?.total??0} page={query.page} rowKey={r=>r.id} loading={loading} error={Boolean(error)} onPageChange={page=>setQuery({...query,page})} columns={[{key:'bill',header:'เลขที่บิล',render:r=>r.saleNo},{key:'payment',header:'payment_id',render:r=><code>{r.paymentId}</code>},{key:'date',header:'วันที่ขาย',render:r=>new Date(r.completedAtUtc).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})},{key:'gross',header:'ยอดก่อนหักค่าธรรมเนียม',render:r=>`฿${displayMoney(r.gross)}`},{key:'fee',header:'ค่าธรรมเนียม 1.5%',render:r=>`฿${displayMoney(r.fee)}`},{key:'net',header:'ยอดรับสุทธิ',render:r=><strong>฿{displayMoney(r.net)}</strong>},{key:'cashier',header:'ผู้ขาย',render:r=>r.cashierName}]}/><p className="report-note">เวลาไทย 00:00:00–23:59:59 ของวันที่เลือก · ตั้งแต่ 00:00:00 นับเป็นวันใหม่ · เฉพาะบิล Gateway ที่ชำระและบันทึกสำเร็จ · ไม่นับบิลยกเลิก · ค่าธรรมเนียม 1.5% ปัดเศษต่อบิล · ยอดรับสุทธิไม่ใช่สถานะโอนเข้าบัญชี</p></>;
}

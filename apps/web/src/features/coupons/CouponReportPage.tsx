import {useEffect,useState} from 'react';
import {z} from 'zod';
import {couponReport} from './schema';
import {DataTable} from '../../components/DataTable';
import {Notice,Busy} from '../../components/Notice';
import {getCouponReport} from './client';
import {thaiToday} from './CouponForm';
import './coupons.css';
type Report=z.infer<typeof couponReport>;
export function CouponReportPage(){
 const [from,setFrom]=useState(thaiToday),[to,setTo]=useState(thaiToday),[query,setQuery]=useState(()=>({from:thaiToday(),to:thaiToday(),page:1})),[data,setData]=useState<Report>(),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');setData(undefined);getCouponReport(query.from,query.to,query.page,c.signal).then(v=>{if(!c.signal.aborted)setData(v);}).catch(()=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[query]);
 return <section><a className="secondary" href="/reports">กลับหน้ารายงาน</a><form className="coupon-report-filters" onSubmit={e=>{e.preventDefault();setQuery({from,to,page:1});}}><label>จากวันที่ <span className="required-marker">*</span><input type="date" required value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>ถึงวันที่ <span className="required-marker">*</span><input type="date" required min={from} value={to} onChange={e=>setTo(e.target.value)}/></label><button className="primary" disabled={loading}>แสดงรายงาน</button></form><p>ใช้คูปองสำเร็จ <strong>{data?data.summary.uses:'—'}</strong> ครั้ง · ส่วนลดคูปองรวม <strong>{data?`฿${data.summary.discount}`:'—'}</strong></p><p className="report-note">วันตามเวลาไทย · ไม่นับบิลยกเลิกในยอดสรุป</p>{error?<Notice>{error}</Notice>:null}{loading?<p role="status"><Busy/>กำลังโหลดรายงาน</p>:null}<DataTable label="รายงานการใช้คูปอง" rows={data?.items??[]} total={data?.total??0} page={query.page} onPageChange={page=>setQuery(v=>({...v,page}))} rowKey={v=>v.id} loading={loading} error={Boolean(error)} columns={[
 {key:'bill',header:'เลขที่บิล',render:v=>v.saleNo},{key:'date',header:'วันที่ขาย',render:v=>new Date(v.completedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})},
 {key:'coupon',header:'คูปอง / โค้ด',render:v=><>{v.name}<br/><code>{v.code}</code></>},{key:'amount',header:'ส่วนลด',render:v=>`฿${v.amount}`},{key:'status',header:'สถานะ',render:v=>v.status==='VOIDED'?'ยกเลิก / คืนสิทธิ์แล้ว':'ใช้สำเร็จ'}
 ]}/></section>;
}

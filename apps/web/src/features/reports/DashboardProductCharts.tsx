import { useEffect,useState } from 'react';
import { TrendingUp,PackageSearch,ChartColumn,RefreshCw } from 'lucide-react';
import type { z } from 'zod';
import { rankingsResult } from './schema';
import { getProductRankings } from './client';
import { RankedProductsChart } from './RankedProductsChart';
import './product-charts.css';
export function DashboardProductCharts({revision}:{revision:number}){
 const [days,setDays]=useState(7),[data,setData]=useState<z.infer<typeof rankingsResult>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');setData(null);getProductRankings(days,c.signal).then(result=>{if(!c.signal.aborted)setData(result);}).catch(()=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[days,revision,retry]);
 const message=loading?'กำลังโหลดข้อมูล':error||undefined;
 return <section className="dashboard-chart-section" aria-label="กราฟอันดับสินค้า"><div className="ranking-toolbar"><div><h2>ภาพรวมสินค้า</h2><p>{data?`${data.fromBangkok} – ${data.toBangkok}`:`ย้อนหลัง ${days} วัน รวมวันนี้ · เวลาไทย`}</p></div><div className="report-presets" role="group" aria-label="ช่วงเวลากราฟสินค้า">{[7,15,30].map(value=><button type="button" className="secondary" aria-pressed={days===value} key={value} onClick={()=>setDays(value)}>{value} วัน</button>)}{error?<button className="secondary" type="button" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={16}/>ลองใหม่</button>:null}</div></div><div className="dashboard-chart-grid"><article className="ranking-card"><h3><TrendingUp size={18}/>สินค้าขายดี 5 อันดับ</h3><p>ขายมากที่สุดใน {days} วันล่าสุด</p><RankedProductsChart label="สินค้าขายดี" items={data?.topProducts??[]} message={message}/></article><article className="ranking-card"><h3><PackageSearch size={18}/>สินค้าคงเหลือขายน้อย</h3><p>5 อันดับขายน้อยสุด · รวมสินค้าที่ยังไม่ขาย</p><RankedProductsChart label="สินค้าคงเหลือขายน้อย" items={data?.slowProducts??[]} tone="amber" message={message}/></article>{[3,4].map(number=><article className="ranking-card ranking-placeholder" key={number}><h3><ChartColumn size={18}/>ข้อมูลเพิ่มเติม {number-2}</h3><p>พื้นที่สำหรับกราฟเพิ่มเติม</p><div className="ranking-empty">ยังไม่มีข้อมูลสำหรับการ์ดนี้</div></article>)}</div></section>;
}

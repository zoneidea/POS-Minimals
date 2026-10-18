import {Banknote,Package,TrendingUp,ChartNoAxesCombined} from 'lucide-react';
import type {ReportData,ReportQuery} from './schema';
import {displayMoney} from './client';
import './financial-overview.css';

type SalesData=Extract<ReportData,{type:'sales'}>;
const formatDate=(value:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(value+'T12:00:00+07:00'));
export function FinancialOverview({data,query,loading,error}:{data:SalesData|null;query:ReportQuery;loading:boolean;error:boolean}){
 const financial=data?.financial,unavailable=loading||error||!data;
 const money=(amount:string|undefined)=>unavailable||amount===undefined?'—':`฿${displayMoney(amount)}`;
 const period=query.from&&query.to?query.from===query.to?formatDate(query.from):`${formatDate(query.from)} – ${formatDate(query.to)}`:'วันนี้';
 const profit=financial?.grossProfit;
 const negative=profit?.startsWith('-')??false;
 return <section className="financial-overview" aria-labelledby="financial-overview-title" aria-busy={loading}>
  <header className="financial-overview-heading"><div><h2 id="financial-overview-title"><ChartNoAxesCombined size={22} aria-hidden="true"/>ภาพรวมการเงิน</h2><p>{period} · ไม่รวม VAT{query.cashierId?' · ตามพนักงานที่เลือก':''}</p></div><span className="financial-overview-badge">{loading?'กำลังโหลด':error?'โหลดไม่สำเร็จ':'ข้อมูลการขายจริง'}</span></header>
  <div className="financial-overview-grid" role="region" aria-label="สรุปยอดขาย ต้นทุน และกำไร" tabIndex={0}>
   <article className="financial-overview-card"><h3><Banknote size={18} aria-hidden="true"/>ยอดขายสุทธิ</h3><strong>{money(financial?.netSalesExVat)}</strong><p>หลังส่วนลด · ไม่รวมบิลยกเลิกและ VAT</p></article>
   <article className="financial-overview-card"><h3><Package size={18} aria-hidden="true"/>ต้นทุนสินค้าที่ขาย</h3><strong>{money(financial?.cogs)}</strong><p>COGS · ต้นทุนที่บันทึก ณ เวลาขาย</p></article>
   <article className={`financial-overview-card financial-overview-profit${negative?' is-negative':''}`}><h3><TrendingUp size={18} aria-hidden="true"/>กำไรขั้นต้น</h3><strong>{money(profit)}</strong><p>{unavailable||!financial?'Gross Margin —':financial.grossMarginPercent===null?'Gross Margin — · ไม่มียอดขายสุทธิ':`Gross Margin ${financial.grossMarginPercent}%`}</p></article>
  </div>
  {error?<p className="financial-overview-status" role="status">ไม่สามารถโหลดข้อมูลได้</p>:!loading&&data?.summary.billCount===0?<p className="financial-overview-status" role="status">ไม่มีข้อมูลการขายในช่วงวันที่เลือก</p>:!loading&&!financial?<p className="financial-overview-status" role="status">ยังไม่มีข้อมูลต้นทุนขายสำหรับภาพรวมการเงิน</p>:null}
 </section>;
}

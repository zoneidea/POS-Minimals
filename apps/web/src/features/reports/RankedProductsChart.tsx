import { useId } from 'react';
export interface RankedProduct {productId:string;name:string;barcode:string;quantity:number;stockQuantity?:number}
const palettes = {primary:['#7057f5','#22b8cf','#f472b6','#60a5fa','#a78bfa'],amber:['#f59e0b','#fb7185','#a78bfa','#2dd4bf','#60a5fa']};
export function RankedProductsChart({items,label,tone='primary',message}:{items:RankedProduct[];label:string;tone?:'primary'|'amber';message?:string}){
 const titleId=useId(),total=items.reduce((sum,item)=>sum+item.quantity,0);
 if(message||!items.length)return <div className="ranking-empty" role="status">{message??`ไม่มีข้อมูล${label}`}</div>;
 let offset=0;
 return <figure className={`ranking-figure ranking-${tone}`}>
  <svg viewBox="0 0 200 180" role="img" aria-labelledby={titleId}>
   <title id={titleId}>{`${label} — จำนวนชิ้นที่ขาย รวม ${total} ชิ้นในรายการที่แสดง`}</title>
   <circle cx="100" cy="88" r="62" fill="none" strokeWidth="22" className="ranking-donut-track"/>
   {items.map((item,index)=>{
    const share=total>0?item.quantity/total*100:0,start=offset;offset+=share;
    return share>0?<circle key={item.productId} data-slice={item.productId} cx="100" cy="88" r="62" fill="none" stroke={palettes[tone][index%5]} strokeWidth="22" pathLength="100" strokeDasharray={`${share} ${100-share}`} strokeDashoffset={-start} transform="rotate(-90 100 88)"><title>{`${item.name}: ${item.quantity} ชิ้น (${share.toFixed(1)}%)`}</title></circle>:null;
   })}
   <text x="100" y="86" textAnchor="middle" className="ranking-total">{total.toLocaleString('th-TH')}</text>
   <text x="100" y="107" textAnchor="middle" className="ranking-center-label">ชิ้น · รวมรายการที่แสดง</text>
  </svg>
  {total===0&&<p className="ranking-zero">ยังไม่มีการขายในช่วงนี้</p>}
  <ol className="ranking-legend">{items.map((item,index)=><li key={item.productId} title={`${item.name} (${item.barcode})${item.stockQuantity!==undefined?` · คงเหลือ ${item.stockQuantity} ชิ้น`:''}`}>
   <span className="ranking-dot" style={{backgroundColor:palettes[tone][index%5]}}/><span className="ranking-product-name">{item.name}</span><strong>{item.quantity.toLocaleString('th-TH')} <small>ชิ้น</small></strong>
  </li>)}</ol>
  <figcaption>สัดส่วนยอดขายของรายการที่แสดง · ไม่นับบิลยกเลิก</figcaption>
 </figure>;
}

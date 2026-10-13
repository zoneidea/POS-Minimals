import { useMemo,useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
export interface RankedProduct {productId:string;name:string;barcode:string;quantity:number;stockQuantity?:number}
const palettes={primary:['#7057f5','#22b8cf','#f472b6','#60a5fa','#a78bfa'],amber:['#f59e0b','#fb7185','#a78bfa','#2dd4bf','#60a5fa']};
export function RankedProductsChart({items,label,tone='primary',message}:{items:RankedProduct[];label:string;tone?:'primary'|'amber';message?:string}){
 const [selected,setSelected]=useState<number|null>(null),[hovered,setHovered]=useState<number|null>(null),active=hovered??selected,total=items.reduce((sum,item)=>sum+item.quantity,0);
 const pieData=useMemo(()=>items.map((item,index)=>({id:item.productId,label:item.name,value:item.quantity,color:palettes.primary[index%5]})),[items]);
 const scatterSeries=useMemo(()=>items.map((item,index)=>({id:item.productId,label:item.name,color:palettes.amber[index%5],markerSize:9,data:[{x:item.stockQuantity??0,y:item.quantity,id:item.productId}],highlightScope:{highlight:'item' as const,fade:'global' as const},valueFormatter:()=>`ขาย ${item.quantity} ชิ้น · คงเหลือ ${item.stockQuantity??0} ชิ้น`})),[items]);
 if(message||!items.length)return <div className="ranking-empty" role="status">{message??`ไม่มีข้อมูล${label}`}</div>;
 const chosen=active!==null?items[active]:undefined;
 return <figure className={`ranking-figure ranking-${tone}`} aria-label={`${label} — จำนวนชิ้นที่ขาย`}>
 {tone==='primary'?<div className="ranking-pie">
 {total>0?<PieChart height={190} hideLegend series={[{id:'products',data:pieData,innerRadius:54,outerRadius:75,paddingAngle:3,cornerRadius:5,highlightScope:{highlight:'item',fade:'global'},highlighted:{additionalRadius:7},faded:{additionalRadius:-3},valueFormatter:item=>`${item.value.toLocaleString('th-TH')} ชิ้น (${(item.value/total*100).toFixed(1)}%)`}]} highlightedItem={active!==null?{seriesId:'products',dataIndex:active}:null} onHighlightChange={item=>setHovered(item?.dataIndex??null)} onItemClick={(_event,item)=>setSelected(selected===item.dataIndex?null:item.dataIndex)}/>:<div className="ranking-neutral-ring" role="img" aria-label={`${label} — จำนวนชิ้นที่ขาย 0 ชิ้น`}/>}
 <div className="ranking-pie-center" aria-hidden="true"><strong>{(chosen?.quantity??total).toLocaleString('th-TH')}</strong><span>{chosen?'ชิ้นที่ขาย':'ชิ้น · รวม 5 อันดับ'}</span></div>
 </div>:<ScatterChart height={190} hideLegend series={scatterSeries} xAxis={[{min:0,max:Math.max(1,...items.map(item=>item.stockQuantity??0))*1.2,label:'คงเหลือ (ชิ้น)',height:36,tickLabelStyle:{fontSize:9}}]} yAxis={[{min:0,max:Math.max(1,...items.map(item=>item.quantity))*1.2,label:'ขาย (ชิ้น)',width:44,tickLabelStyle:{fontSize:9}}]} grid={{horizontal:true,vertical:true}} highlightedItem={active!==null&&items[active]?{seriesId:items[active]!.productId,dataIndex:0}:null} onHighlightChange={item=>setHovered(item?items.findIndex(product=>product.productId===item.seriesId):null)} onItemClick={(_event:unknown,item:{seriesId:string|number})=>{const index=items.findIndex(product=>product.productId===item.seriesId);setSelected(selected===index?null:index);}}/>
 }
 {total===0?<p className="ranking-zero">ยังไม่มีการขายในช่วงนี้</p>:null}
 <ol className="ranking-legend">{items.map((item,index)=><li key={item.productId}><button type="button" aria-pressed={selected===index} onClick={()=>setSelected(selected===index?null:index)} onMouseEnter={()=>setHovered(index)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(index)} onBlur={()=>setHovered(null)} title={`${item.name} (${item.barcode})${item.stockQuantity!==undefined?` · คงเหลือ ${item.stockQuantity} ชิ้น`:''}`}>
 <span className="ranking-dot" style={{backgroundColor:palettes[tone][index%5]}}/><span className="ranking-product-name">{item.name}</span><strong>{item.quantity.toLocaleString('th-TH')} <small>ชิ้น</small></strong>
 </button></li>)}</ol>
 <figcaption className="chart-selection" role="status">{chosen?`${chosen.name} · ขาย ${chosen.quantity} ชิ้น${chosen.stockQuantity!==undefined?` · คงเหลือ ${chosen.stockQuantity} ชิ้น`:''}`:tone==='primary'?'สัดส่วนยอดขายของ 5 อันดับ · เลือกสินค้าเพื่อดูข้อมูล':'จำนวนคงเหลือเทียบจำนวนที่ขาย · เลือกสินค้าเพื่อดูข้อมูล'}</figcaption>
 </figure>;
}

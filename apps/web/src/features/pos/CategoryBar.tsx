import { useEffect,useState } from 'react';
import { ChevronLeft,ChevronRight } from 'lucide-react';
import { listCategories,type Category } from '../categories/client';
export function CategoryBar({selected,onSelect}:{selected:string;onSelect:(id:string)=>void}){
 const [items,setItems]=useState<Category[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError(false);listCategories(page,controller.signal).then(data=>{if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[page,revision]);
 return <div className="pos-categories" role="group" aria-label="หมวดหมู่สินค้า"><button aria-pressed={!selected} onClick={()=>onSelect('')}>ทั้งหมด</button>{items.map(item=><button key={item.id} aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}>{item.name}</button>)}{page>1?<button aria-label="หมวดหมู่ก่อนหน้า" onClick={()=>setPage(page-1)}><ChevronLeft size={16}/></button>:null}{page*10<total?<button aria-label="หมวดหมู่ถัดไป" onClick={()=>setPage(page+1)}><ChevronRight size={16}/></button>:null}{error?<button onClick={()=>setRevision(v=>v+1)}>ลองโหลดหมวดหมู่อีกครั้ง</button>:null}</div>;
}

import { Search } from 'lucide-react';
import { useEffect,useRef,useState } from 'react';
import { listCatalog,type CatalogProduct } from './client';
import { findScannedProduct } from './scan-product';
export function CatalogSearch({onSearch,onAdd}:{onSearch:(search:string,barcode:string)=>void;onAdd:(product:CatalogProduct)=>void}) {
 const input=useRef<HTMLInputElement>(null),requests=useRef(new Set<AbortController>());
 const [error,setError]=useState('');
 useEffect(()=>()=>{for(const controller of requests.current)controller.abort();requests.current.clear();},[]);
 async function submit(){
  const value=input.current?.value.trim()??'';setError('');
  if(!value){onSearch('','');return;}
  const controller=new AbortController();requests.current.add(controller);
  try{
   const product=await findScannedProduct(value,listCatalog,controller.signal);
   if(controller.signal.aborted)return;
   if(product){
    if(product.quantityOnHand<=0){setError('สินค้าหมดสต็อก');return;}
    onAdd(product);
    if(input.current?.value.trim()===value){input.current.value='';input.current.focus();}
   }else if(input.current?.value.trim()===value)onSearch(value,'');
  }catch{if(!controller.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}
  finally{requests.current.delete(controller);}
 }
 return <div className="pos-search-field"><form className="pos-search" onSubmit={event=>{event.preventDefault();void submit();}}><Search size={18} aria-hidden="true"/><input ref={input} name="search" aria-label="ค้นหาสินค้า" placeholder="ค้นหาสินค้า / SKU / สแกนบาร์โค้ด แล้วกด Enter" maxLength={200} autoComplete="off"/><button type="submit" aria-label="ค้นหา"><Search size={18}/></button></form>{error?<small role="alert">{error}</small>:null}</div>;
}

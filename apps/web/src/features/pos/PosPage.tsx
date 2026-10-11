import { useEffect,useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { CatalogSearch } from './CatalogSearch';
import { CatalogTable } from './CatalogTable';
import { listCatalog,type CatalogProduct } from './client';
export function PosPage(){
 const [query,setQuery]=useState({search:'',barcode:'',page:1}),[revision,setRevision]=useState(0),[items,setItems]=useState<CatalogProduct[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');listCatalog(query.page,query.search,query.barcode,controller.signal).then(data=>{if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}}).catch(error=>{if(!controller.signal.aborted)setError(authMessage(error));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[query,revision]);
 return <section className="pos-catalog"><CatalogSearch onSearch={(search,barcode)=>setQuery({search,barcode,page:1})}/>
 <div className="category-toolbar"><p className="product-note">รายการสินค้าจริงของร้าน · ตะกร้าและชำระเงินอยู่ระหว่างพัฒนา</p><button className="secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18} aria-hidden="true"/>โหลดใหม่</button></div>
 {loading?<div className="loading" role="status"><Busy/>กำลังโหลดสินค้า</div>:error?<><Notice>{error}</Notice><button className="secondary" onClick={()=>setRevision(v=>v+1)}>ลองโหลดใหม่</button></>:<CatalogTable items={items} total={total} page={query.page} onPageChange={page=>setQuery(current=>({...current,page}))}/>}
 </section>;
}

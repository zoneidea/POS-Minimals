import { useEffect,useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { CatalogSearch } from './CatalogSearch';
import { CategoryBar } from './CategoryBar';
import { ProductGrid } from './ProductGrid';
import { CartPanel } from './CartPanel';
import { useCart } from './use-cart';
import { addToCart,changeQuantity } from './cart';
import { listCatalog,type CatalogProduct } from './client';
import './pos.css';
export function PosPage({userId,orgId}:{userId:string;orgId:string}){
 const [query,setQuery]=useState({search:'',barcode:'',categoryId:'',page:1}),[revision,setRevision]=useState(0),[items,setItems]=useState<CatalogProduct[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const cart=useCart(userId,orgId);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');listCatalog(query.page,query.search,query.barcode,controller.signal,query.categoryId).then(data=>{if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}}).catch(error=>{if(!controller.signal.aborted)setError(authMessage(error));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[query,revision]);
 return <section className="pos-layout"><div className="pos-catalog"><div className="pos-topbar"><CatalogSearch onSearch={(search,barcode)=>setQuery(current=>({...current,search,barcode,page:1}))}/><button className="secondary" aria-label="โหลดสินค้าใหม่" disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/></button></div>
 <CategoryBar selected={query.categoryId} onSelect={categoryId=>setQuery(current=>({...current,categoryId,page:1}))}/>
 {cart.error?<Notice>{cart.error}</Notice>:null}
 {loading?<div className="loading" role="status"><Busy/>กำลังโหลดสินค้า</div>:error?<><Notice>{error}</Notice><button className="secondary" onClick={()=>setRevision(v=>v+1)}>ลองโหลดใหม่</button></>:<ProductGrid items={items} total={total} page={query.page} onPageChange={page=>setQuery(current=>({...current,page}))} onAdd={product=>cart.setItems(current=>addToCart(current,product))}/>}
 </div><CartPanel items={cart.items} onQuantity={(id,delta)=>cart.setItems(current=>changeQuantity(current,id,delta))} onRemove={id=>cart.setItems(current=>current.filter(item=>item.id!==id))} onClear={()=>cart.setItems([])}/></section>;
}

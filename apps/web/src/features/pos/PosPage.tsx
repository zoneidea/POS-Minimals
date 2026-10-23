import {lazy,Suspense} from 'react';
const RestaurantPage=lazy(()=>import('../restaurant/RestaurantPage').then(m=>({default:m.RestaurantPage})));
import {useCafeConfiguration} from '../cafe-options/use-cafe-configuration';
import {getCafeConfiguration} from '../cafe-options/client';
import {ProductChoicesDialog} from '../cafe-options/ProductChoicesDialog';
import {applyCafeLine,cartLineKey} from '../cafe-options/cart-lines';
import type {CartItem} from './cart';
import {CustomerDisplayProvider} from '../customer-display/CustomerDisplayProvider';
import {FullscreenButton} from './FullscreenButton';
import { useEffect,useState,useRef } from 'react';
import { RefreshCw,LayoutGrid,List } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { CatalogSearch } from './CatalogSearch';
import { CategoryBar } from './CategoryBar';
import { CatalogTable } from './CatalogTable';
import { ProductGrid } from './ProductGrid';
import { CartPanel } from './CartPanel';
import {useParkedCart} from './use-parked-cart';
import {ParkedBills} from './ParkedBills';
import { addToCart } from './cart';
import { listCatalog,type CatalogProduct } from './client';
import { initializeReservepay } from '../../lib/reservepay-sdk';
import './pos.css';
export function PosPage({userId,orgId,canManage=false}:{userId:string;orgId:string;canManage?:boolean}){
 const cafe=useCafeConfiguration(getCafeConfiguration),[choices,setChoices]=useState<{product:CatalogProduct;initial?:CartItem}|null>(null),[optionsError,setOptionsError]=useState('');
 const [query,setQuery]=useState({search:'',barcode:'',categoryId:'',page:1}),[revision,setRevision]=useState(0),[items,setItems]=useState<CatalogProduct[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [view,setView]=useState<'grid'|'list'>('grid');
 const [sdkError,setSdkError]=useState('');
 useEffect(()=>{let active=true;initializeReservepay().catch(()=>{if(active)setSdkError('ไม่สามารถเริ่มต้น ReservePay ได้ การขายเงินสดยังใช้งานได้');});return()=>{active=false;};},[]);
 const lastQuery=useRef('');
 const cart=useParkedCart(userId,orgId);
 const handleAdd=(product:CatalogProduct)=>{if(!cafe.data){setOptionsError(cafe.error||'กำลังโหลดตัวเลือกเมนู กรุณารอสักครู่');return;}setOptionsError('');if(cafe.data.storeMode==='CAFE')setChoices({product});else cart.setItems(current=>addToCart(current,product));};
 const edit=(item:CartItem)=>setChoices({product:items.find(p=>p.id===item.id)??{id:item.id,name:item.name,barcode:item.barcode,salePrice:item.baseUnitPrice??item.salePrice,trackStock:item.trackStock,quantityOnHand:item.stock,rowVersion:1,categoryId:null,imageUrl:null},initial:item});
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');const key=JSON.stringify([userId,orgId,query]);if(lastQuery.current!==key){setItems([]);setTotal(0);}lastQuery.current=key;listCatalog(query.page,query.search,query.barcode,controller.signal,query.categoryId).then(data=>{if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}}).catch(error=>{if(!controller.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[query.page,query.search,query.barcode,query.categoryId,revision,userId,orgId]);
 if(cafe.data?.storeMode==='RESTAURANT')return <Suspense fallback={<p role="status">กำลังเปิดโต๊ะร้านอาหาร</p>}><RestaurantPage userId={userId} orgId={orgId} canManage={canManage} configuration={cafe.data}/></Suspense>;
 return <section className="pos-layout"><div className="pos-catalog">{cafe.error?<p role="status">{cafe.error}</p>:null}{optionsError?<Notice>{optionsError}</Notice>:null}<div className="pos-topbar"><CatalogSearch focusKey={revision} items={loading||error?[]:items} onAdd={handleAdd} onSearch={(search,barcode)=>setQuery(current=>({...current,search,barcode,page:1}))}/><div className="pos-view-toggle" role="group" aria-label="รูปแบบแสดงสินค้า"><button className="secondary" aria-label="แสดงแบบ Grid" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><LayoutGrid size={18}/></button><button className="secondary" aria-label="แสดงแบบรายการ" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={18}/></button></div><FullscreenButton/></div>
 <CategoryBar selected={query.categoryId} onSelect={categoryId=>setQuery(current=>({...current,categoryId,page:1}))}/>
 {sdkError?<Notice>{sdkError}</Notice>:null}
 {cart.error?<Notice>{cart.error}</Notice>:null}
 <div className="pos-catalog-results" aria-busy={loading}>
 {loading?<div className="pos-loading" role="status"><Busy/>กำลังโหลดสินค้า</div>:null}
 {error?<><Notice>{error}</Notice></>:null}
 {(view==='grid'?<ProductGrid hideUntrackedStock={cafe.data?.storeMode==='CAFE'} error={Boolean(error)} loading={loading} items={items} total={total} page={query.page} onPageChange={page=>{if(!loading)setQuery(current=>({...current,page}));}} onAdd={handleAdd}/>:<CatalogTable error={Boolean(error)} loading={loading} items={items} total={total} page={query.page} onPageChange={page=>{if(!loading)setQuery(current=>({...current,page}));}} onAdd={handleAdd}/>)}
 </div>
 </div><CustomerDisplayProvider scope={`${userId}:${orgId}`} items={cart.items}><CartPanel disabled={cart.blocked} billActions={<ParkedBills bills={cart.bills} empty={!cart.items.length} disabled={cart.blocked} onPark={cart.park} onRecall={cart.recall} onDiscard={cart.discard}/>} scope={`${userId}:${orgId}`} onSale={()=>{cart.setItems([]);setRevision(value=>value+1);}} items={cart.items} onEdit={cafe.data?.storeMode==='CAFE'?edit:undefined} onRemove={id=>cart.setItems(current=>current.filter(item=>cartLineKey(item)!==id))} onClear={()=>cart.setItems([])}/></CustomerDisplayProvider>{choices?<ProductChoicesDialog product={choices.product} initial={choices.initial} groups={cafe.data?.groups.filter(g=>g.enabled&&g.productIds.includes(choices.product.id))??[]} onClose={()=>setChoices(null)} onSave={(options,note,quantity)=>{cart.setItems(current=>applyCafeLine(current,choices.product,options,note,quantity,choices.initial?cartLineKey(choices.initial):undefined));setChoices(null);}}/>:null}</section>;
}

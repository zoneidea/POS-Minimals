import {useCafeConfiguration} from '../cafe-options/use-cafe-configuration';
import {ProductChoicesDialog} from '../cafe-options/ProductChoicesDialog';
import {applyCafeLine,cartLineKey} from '../cafe-options/cart-lines';
import {useEffect,useRef,useState} from 'react';
import {ShoppingBasket,Search} from 'lucide-react';
import {ProductGrid} from '../pos/ProductGrid';
import {addToCart,cartTotal,formatAmount,type CartItem} from '../pos/cart';
import {findLoadedBarcode,findScannedProduct} from '../pos/scan-product';
import {lineApi} from './api';
import {LineCategories} from './LineCategories';
import {LineCart} from './LineCart';
import {LineCheckout} from './LineCheckout';
import {lineCartKey,readLineCart,readLinePending} from './storage';
import type {lineProduct,LineSale} from './schema';
import type {CatalogProduct} from '../pos/client';
import type {z} from 'zod';
export function LinePos({scope,onSale,onLocked}:{scope:string;onSale:(sale:LineSale)=>void;onLocked:(value:boolean)=>void}){
 const cafe=useCafeConfiguration(lineApi.cafeOptions),[choices,setChoices]=useState<{product:CatalogProduct;initial?:CartItem}|null>(null);
 const [items,setItems]=useState<CartItem[]>([]),[storageError,setStorageError]=useState(''),[query,setQuery]=useState({search:'',categoryId:'',page:1}),[catalog,setCatalog]=useState<z.infer<typeof lineProduct>[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[screen,setScreen]=useState<'catalog'|'cart'|'checkout'>('catalog'),[revision,setRevision]=useState(0),[ready,setReady]=useState(false);
 const scans=useRef(new Set<AbortController>()),currentItems=useRef<CartItem[]>([]),alive=useRef(true);
 useEffect(()=>{alive.current=true;try{const restored=readLineCart(scope);currentItems.current=restored;setItems(restored);if(readLinePending(scope))setScreen('checkout');setReady(true);}catch{setStorageError('อ่านตะกร้าหรือรายการขายค้างไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บก่อนเริ่มขาย');}return()=>{alive.current=false;for(const c of scans.current)c.abort();};},[scope]);
 const save=(next:CartItem[])=>{try{if(next.length)localStorage.setItem(lineCartKey(scope),JSON.stringify(next));else localStorage.removeItem(lineCartKey(scope));setStorageError('');}catch{setStorageError('ไม่สามารถบันทึกตะกร้าในเครื่องได้');}currentItems.current=next;setItems(next);};
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');setCatalog([]);lineApi.catalog(query.page,query.search,'',c.signal,query.categoryId).then(v=>{if(!c.signal.aborted){setCatalog(v.items);setTotal(v.total);}}).catch(()=>{if(!c.signal.aborted){setError('ไม่สามารถโหลดข้อมูลได้');setTotal(0);}}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[query,revision]);
 const add=(product:CatalogProduct)=>{if(!ready)return;if(!cafe.data){setError(cafe.error||'กำลังโหลดตัวเลือกเมนู');return;}if(cafe.data.storeMode==='CAFE')setChoices({product});else save(addToCart(currentItems.current,product));};
 const edit=(item:CartItem)=>{setScreen('catalog');setChoices({product:catalog.find(p=>p.id===item.id)??{id:item.id,name:item.name,barcode:item.barcode,salePrice:item.baseUnitPrice??item.salePrice,trackStock:item.trackStock,quantityOnHand:item.stock,rowVersion:1,categoryId:null,imageUrl:null},initial:item});};
 async function submitSearch(){if(!ready)return;const value=search.trim();if(!value){setQuery(v=>({...v,search:'',page:1}));return;}const c=new AbortController();scans.current.add(c);try{const product=findLoadedBarcode(value,catalog)??await findScannedProduct(value,lineApi.catalog,c.signal);if(c.signal.aborted)return;if(product){if(product.trackStock!==false&&product.quantityOnHand===0){setError('สินค้าหมดสต็อก');return;}add(product);setSearch('');}else setQuery(v=>({...v,search:value,page:1}));}catch{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}finally{scans.current.delete(c);}}
 if(cafe.data?.storeMode==='RESTAURANT'&&screen!=='checkout')return <section className="line-pos"><h1>โหมดร้านอาหาร</h1><p className="line-notice">จัดการโต๊ะและรับเงินได้ในระบบเว็บ กรุณาไปที่บัญชีร้าน แล้วกดเปิดระบบเว็บ</p></section>;
 return <section className="line-pos"><h1>ขายสินค้า</h1><form className="line-search" onSubmit={e=>{e.preventDefault();void submitSearch();}}><Search size={19}/><input aria-label="ค้นหาสินค้า" placeholder="ค้นหาสินค้า / บาร์โค้ด" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)} enterKeyHint="search"/><button className="line-icon" aria-label="ค้นหา" type="submit"><Search size={18}/></button></form><LineCategories selected={query.categoryId} onSelect={categoryId=>setQuery(v=>({...v,categoryId,page:1}))}/>{storageError?<p className="line-notice" role="alert">{storageError}</p>:null}{error?<p className="line-notice" role="alert">{error}</p>:null}<ProductGrid hideUntrackedStock={cafe.data?.storeMode==='CAFE'} items={catalog} total={total} page={query.page} onPageChange={page=>setQuery(v=>({...v,page}))} onAdd={add} loading={loading||!ready} error={Boolean(error)}/>
 <div className="line-cart-bar"><ShoppingBasket size={24}/><div><span>{items.reduce((s,i)=>s+i.quantity,0)} รายการ</span><strong>฿{formatAmount(cartTotal(items))}</strong></div><button className="line-primary" disabled={!ready||!items.length} onClick={()=>setScreen('cart')}>ดูตะกร้า</button></div>
 {screen==='cart'?<LineCart onEdit={cafe.data?.storeMode==='CAFE'?edit:undefined} locked={false} items={items} onRemove={id=>save(items.filter(i=>cartLineKey(i)!==id))} onClear={()=>save([])} onClose={()=>setScreen('catalog')} onCheckout={()=>setScreen('checkout')}/>:null}
 {screen==='checkout'?<LineCheckout scope={scope} items={items} onLocked={onLocked} onClose={()=>setScreen('cart')} onSuccess={(sale,same)=>{if(same)save([]);if(!alive.current)return;setScreen('catalog');setRevision(v=>v+1);onLocked(false);onSale(sale);}}/>:null}{choices?<ProductChoicesDialog product={choices.product} initial={choices.initial} groups={cafe.data?.groups.filter(g=>g.enabled&&g.productIds.includes(choices.product.id))??[]} onClose={()=>setChoices(null)} onSave={(options,note,quantity)=>{save(applyCafeLine(currentItems.current,choices.product,options,note,quantity,choices.initial?cartLineKey(choices.initial):undefined));setChoices(null);}}/>:null}</section>;
}

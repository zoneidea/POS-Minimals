import {RestaurantCart} from './RestaurantCart';
import {RestaurantRoundHistory} from './RestaurantRoundHistory';
import {useEffect,useState} from 'react';
import type {CafeConfiguration} from '@pos/contracts/cafe-options';
import {restaurantRoundInput,type RestaurantBill} from '@pos/contracts/restaurant';
import {Busy,Notice} from '../../components/Notice';
import {authMessage} from '../../lib/client';
import {CatalogSearch} from '../pos/CatalogSearch';
import {CategoryBar} from '../pos/CategoryBar';
import {ProductGrid} from '../pos/ProductGrid';
import {useCart} from '../pos/use-cart';
import {listCatalog,type CatalogProduct} from '../pos/client';
import {ProductChoicesDialog} from '../cafe-options/ProductChoicesDialog';
import {applyCafeLine,quoteLine,cartLineKey} from '../cafe-options/cart-lines';
import {CafeItemDetails} from '../cafe-options/CafeItemDetails';
import {cartTotal,formatAmount} from '../pos/cart';
import {useRestaurantAttempt} from './use-restaurant-attempt';
import {sendRound} from './client';
import {printRound} from './print-round';
import '../pos/pos.css';
export function RestaurantOrderComposer({bill,userId,orgId,configuration,onBack,onSent,onPrintStatus,onCheckout,canManage,onRefresh}:{bill:RestaurantBill;userId:string;orgId:string;configuration:CafeConfiguration;onBack:()=>void;onSent:(bill:RestaurantBill)=>void;onCheckout:()=>void;canManage:boolean;onRefresh:()=>void;onPrintStatus:(s:string)=>void}){
 const cart=useCart(userId,`${orgId}:restaurant:${bill.id}`),[query,setQuery]=useState({search:'',barcode:'',categoryId:'',page:1}),[products,setProducts]=useState<CatalogProduct[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[choice,setChoice]=useState<CatalogProduct|null>(null);
 const attempt=useRestaurantAttempt(`${userId}:${orgId}:restaurant:round:${bill.id}`,restaurantRoundInput,async input=>({bill:await sendRound(bill.id,input),key:input.key}),async({bill:updated,key})=>{cart.setItems([]);onSent(updated);const round=updated.rounds.find(r=>r.id===key);if(round&&!round.cancelled)try{await printRound(updated,round);onPrintStatus(`ส่งใบเตรียมโต๊ะ ${updated.tableName} รอบ ${round.number} เข้าคิวพิมพ์แล้ว`);}catch(e){onPrintStatus(`บันทึกออเดอร์แล้ว แต่พิมพ์ไม่สำเร็จ: ${authMessage(e)} · พิมพ์ซ้ำจากรายการรอบได้`);}});
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');listCatalog(query.page,query.search,query.barcode,c.signal,query.categoryId).then(r=>{if(!c.signal.aborted){setProducts(r.items);setTotal(r.total);}}).catch(e=>{if(!c.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[query]);
 const locked=attempt.busy||attempt.blocked||Boolean(attempt.pending);
 return <section className="restaurant-order-screen"><div className="restaurant-toolbar"><h2>โต๊ะ {bill.tableName} · สั่งอาหาร</h2><button className="secondary" disabled={attempt.busy} onClick={onBack}>เลือกโต๊ะอื่น</button></div><div className="restaurant-compose"><fieldset disabled={locked} className="restaurant-catalog"><CatalogSearch items={loading?[]:products} onAdd={setChoice} onSearch={(search,barcode)=>setQuery(q=>({...q,search,barcode,page:1}))}/><CategoryBar selected={query.categoryId} onSelect={categoryId=>setQuery(q=>({...q,categoryId,page:1}))}/>{loading?<p role="status"><Busy/>กำลังโหลดเมนู</p>:null}{error?<Notice>{error}</Notice>:null}<ProductGrid items={products} total={total} page={query.page} onPageChange={page=>setQuery(q=>({...q,page}))} onAdd={setChoice} loading={loading} error={Boolean(error)}/></fieldset>
 <RestaurantCart bill={bill} draft={cart.items} locked={locked} busy={attempt.busy} hasPending={Boolean(attempt.pending)} error={cart.error||attempt.error} onRemove={id=>cart.setItems(items=>items.filter(i=>cartLineKey(i)!==id))} onSend={()=>void attempt.submit(attempt.pending??{key:crypto.randomUUID(),version:bill.version,items:cart.items.map(i=>({...quoteLine(i),expectedUnitPrice:i.salePrice}))})} onCheckout={onCheckout}/></div><RestaurantRoundHistory bill={bill} canManage={canManage} onChanged={onRefresh}/>

 {choice&&!locked?<ProductChoicesDialog product={choice} groups={configuration.groups.filter(g=>g.enabled&&g.productIds.includes(choice.id))} onClose={()=>setChoice(null)} onSave={(options,note,quantity)=>{cart.setItems(items=>applyCafeLine(items,choice,options,note,quantity));setChoice(null);}}/>:null}</section>;
}

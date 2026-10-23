import {useEffect,useState,useRef} from 'react';
import {QrCode} from 'lucide-react';
import type {CafeConfiguration} from '@pos/contracts/cafe-options';
import type {RestaurantTable} from '@pos/contracts/restaurant';
import {Busy,Notice} from '../../components/Notice';
import {FullscreenButton} from '../pos/FullscreenButton';
import {CheckoutModal} from '../pos/CheckoutModal';
import {completeCheckout} from '../pos/complete-checkout';
import {CustomerDisplayProvider} from '../customer-display/CustomerDisplayProvider';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {PendingRestaurantPayments,pendingRestaurantPayments} from './PendingRestaurantPayments';
import {openBill,cancelBill} from './client';
import {RestaurantOrderComposer} from './RestaurantOrderComposer';
import {RestaurantFloorplan} from './RestaurantFloorplan';
import {RestaurantCart} from './RestaurantCart';
import {useRestaurantBoard} from './use-restaurant-board';
import {billCartItems} from './bill-cart';
import {useViewNotice} from './use-view-notice';
import {GuestAccessDialog} from './GuestAccessDialog';
import './restaurant.css';
export function RestaurantPage({userId,orgId,canManage,configuration}:{userId:string;orgId:string;canManage:boolean;configuration:CafeConfiguration}){
 const board=useRestaurantBoard(),[selected,setSelected]=useState(''),[cash,setCash]=useState(false),[busy,setBusy]=useState(false),[zone,setZone]=useState(''),[ordering,setOrdering]=useState(false),[noticeView,setNoticeView]=useState(0),[guestQr,setGuestQr]=useState(false);
 const [status,setStatus]=useViewNotice(String(noticeView));
 const clearStatus=()=>setNoticeView(v=>v+1);
 const opening=useRef(false),completed=useRef(new Set<string>()),scope=`${userId}:${orgId}`;
 const bill=board.tables.find(t=>t.bill?.id===selected)?.bill;
 useEffect(()=>{if(cash&&!bill&&!board.loading){setCash(false);setSelected('');}},[cash,bill,board.loading]);
 useEffect(()=>{if(!bill)setGuestQr(false);},[bill]);
 const sent=bill?billCartItems(bill):[];
 async function open(table:RestaurantTable){if(opening.current)return;clearStatus();if(table.bill){setSelected(table.bill.id);setOrdering(false);return;}opening.current=true;setBusy(true);const storage=`${scope}:restaurant:open:${table.id}`;try{if(!await confirmAlert(`ยืนยันเปิดโต๊ะ ${table.name} สำหรับลูกค้าหรือไม่?`))return;const key=localStorage.getItem(storage)??crypto.randomUUID();localStorage.setItem(storage,key);const result=await openBill(table.id,key);localStorage.removeItem(storage);board.acceptBill(result);if(result.status==='OPEN'){setSelected(result.id);setOrdering(true);}else await warningAlert('บิลจากคำขอเดิมปิดแล้ว เลือกโต๊ะอีกครั้งเพื่อเริ่มบิลใหม่');}catch(e){await warningAlert(authMessage(e));}finally{opening.current=false;setBusy(false);}}
 return <CustomerDisplayProvider scope={scope} items={sent}><div className="restaurant-page"><div className="restaurant-toolbar"><div className="category-actions">{bill&&!sent.length?<button className="secondary danger" disabled={busy} onClick={async()=>{if(!await confirmAlert('ปิดโต๊ะที่ไม่มีออเดอร์ในบิลหรือไม่?'))return;setBusy(true);try{board.acceptBill(await cancelBill(bill.id,bill.version));setSelected('');await successAlert('ปิดโต๊ะแล้ว');}catch(e){await warningAlert(authMessage(e));}finally{setBusy(false);}}}>ปิดโต๊ะว่าง</button>:null}{bill?<button className="secondary" onClick={()=>setGuestQr(true)}><QrCode size={18}/>QR สั่งอาหาร</button>:null}<FullscreenButton/></div></div>
 {!cash?<PendingRestaurantPayments scope={scope} onRecovered={()=>{setSelected('');board.reload();}} onStatus={setStatus}/>:null}{status?<p role="status" className="notice">{status}</p>:null}{board.error?<Notice>{board.error}</Notice>:null}{board.loading?<p role="status"><Busy/>กำลังโหลดโต๊ะ</p>:null}
 {bill&&ordering?<RestaurantOrderComposer key={`order:${bill.id}`} bill={bill} userId={userId} orgId={orgId} configuration={configuration} canManage={canManage} onBack={()=>{clearStatus();setOrdering(false);}} onSent={board.acceptBill} onRefresh={board.reload} onPrintStatus={setStatus} onCheckout={()=>{if(pendingRestaurantPayments(scope).length)setStatus('กรุณาตรวจสอบผลรับเงินเดิมก่อนเริ่มรายการใหม่');else setCash(true);}}/>:<div className={`restaurant-floor-layout${bill?' has-selected-table':''}`}><RestaurantFloorplan tables={board.tables} loading={board.loading} disabled={busy||Boolean(board.error)} canManage={canManage} selected={bill?.tableId} zone={zone} onZone={z=>{clearStatus();setZone(z);}} onSelect={table=>void open(table)}/>{bill?<RestaurantCart key={`overview:${bill.id}`} bill={bill} draft={[]} overview locked={Boolean(pendingRestaurantPayments(scope).length)||Boolean(board.error)} busy={busy} hasPending={false} onRemove={()=>{}} onSend={()=>{clearStatus();setOrdering(true);}} onCheckout={()=>{if(pendingRestaurantPayments(scope).length)setStatus('กรุณาตรวจสอบผลรับเงินเดิมก่อนเริ่มรายการใหม่');else setCash(true);}}/>:null}</div>}

 {guestQr&&bill?<GuestAccessDialog bill={bill} onClose={()=>setGuestQr(false)}/>:null}
 {cash&&bill?<CheckoutModal key={`checkout:${bill.id}`} restaurant={bill} items={sent} scope={scope} onClose={()=>setCash(false)} onSuccess={sale=>{if(completed.current.has(sale.saleId))return;completed.current.add(sale.saleId);void completeCheckout(sale,true,{close:()=>setCash(false),clear:()=>{setSelected('');board.reload();},status:setStatus});}}/>:null}
 </div></CustomerDisplayProvider>;
}

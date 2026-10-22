import {PendingRestaurantPayments,pendingRestaurantPayments} from './PendingRestaurantPayments';
import {useEffect,useState,useRef} from 'react';
import {Armchair,Plus,Settings2,UtensilsCrossed} from 'lucide-react';
import type {CafeConfiguration} from '@pos/contracts/cafe-options';
import type {RestaurantTable} from '@pos/contracts/restaurant';
import {Busy,Notice} from '../../components/Notice';
import {FullscreenButton} from '../pos/FullscreenButton';
import {authMessage} from '../../lib/client';
import {getBoard,openBill} from './client';
import {TableEditor} from './TableEditor';
import {RestaurantBillView} from './RestaurantBillView';
import {RestaurantOrderComposer} from './RestaurantOrderComposer';
import {RestaurantCashDialog} from './RestaurantCashDialog';
import './restaurant.css';
export function RestaurantPage({userId,orgId,canManage,configuration}:{userId:string;orgId:string;canManage:boolean;configuration:CafeConfiguration}){
 const [tables,setTables]=useState<RestaurantTable[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[selected,setSelected]=useState(''),[editor,setEditor]=useState<RestaurantTable|true|null>(null),[view,setView]=useState<'bill'|'add'>('bill'),[cash,setCash]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[zone,setZone]=useState('');
 const opening=useRef(false),reload=()=>setRevision(v=>v+1);
 useEffect(()=>{const c=new AbortController();getBoard(c.signal).then(r=>{if(!c.signal.aborted){setTables(r.tables);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision]);
 useEffect(()=>{const refresh=()=>{if(!document.hidden)reload();},timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 const hasPending=pendingRestaurantPayments(`${userId}:${orgId}`).length>0;
 const bill=tables.find(t=>t.bill?.id===selected)?.bill;
 useEffect(()=>{if(cash&&!bill&&!loading){setCash(false);setSelected('');}},[cash,bill,loading]);
 const scope=`${userId}:${orgId}`,zones=[...new Set(tables.map(t=>t.zone))].filter(Boolean);
 async function open(table:RestaurantTable){if(opening.current)return;if(table.bill){setSelected(table.bill.id);setView('bill');return;}opening.current=true;setBusy(true);setError('');const storage=`${scope}:restaurant:open:${table.id}`;try{const key=localStorage.getItem(storage)??crypto.randomUUID();localStorage.setItem(storage,key);const result=await openBill(table.id,key);localStorage.removeItem(storage);reload();if(result.status==='OPEN'){setSelected(result.id);setView('bill');}else setStatus('คำขอเปิดโต๊ะเดิมปิดบิลไปแล้ว เลือกโต๊ะอีกครั้งเพื่อเริ่มบิลใหม่');}catch(e){setError(authMessage(e));}finally{opening.current=false;setBusy(false);}}
 return <div className="restaurant-page"><div className="restaurant-toolbar"><div><h2><UtensilsCrossed size={22}/>โหมดร้านอาหาร</h2><p className="hint">เปิดโต๊ะ สั่งเพิ่ม และคิดเงินหลังรับประทาน · รองรับเงินสดในรอบแรก</p></div><div className="category-actions">{canManage&&!bill?<button className="primary" disabled={busy||loading||Boolean(error)} onClick={()=>setEditor(true)}><Plus size={17}/>เพิ่มโต๊ะ</button>:null}<FullscreenButton/></div></div>{!cash?<PendingRestaurantPayments scope={`${userId}:${orgId}`} onRecovered={()=>{setSelected('');reload();}} onStatus={setStatus}/>:null}{status?<p role="status" className="notice">{status}</p>:null}{error?<Notice>{error}</Notice>:null}{loading?<p role="status"><Busy/>กำลังโหลดโต๊ะ</p>:null}
 {bill?view==='add'?<RestaurantOrderComposer key={bill.id} bill={bill} userId={userId} orgId={orgId} configuration={configuration} onBack={()=>setView('bill')} onSent={()=>{setView('bill');reload();}} onPrintStatus={setStatus}/>:<RestaurantBillView bill={bill} canManage={canManage} onBack={()=>{setSelected('');setView('bill');}} onChanged={reload} onAdd={()=>setView('add')} onCash={()=>{if(hasPending)setStatus('กรุณาตรวจสอบคำขอรับเงินเดิมจากข้อความด้านบนก่อน');else setCash(true);}}/>:<><div className="restaurant-zone" role="group" aria-label="โซนโต๊ะ"><button className="secondary" aria-pressed={!zone} onClick={()=>setZone('')}>ทุกโซน</button>{zones.map(z=><button className="secondary" aria-pressed={zone===z} onClick={()=>setZone(z)} key={z}>{z}</button>)}</div>{!loading&&!tables.length?<p className="restaurant-empty">{canManage?'ยังไม่มีโต๊ะ กดเพิ่มโต๊ะเพื่อเริ่มใช้งาน':'เจ้าของร้านยังไม่ได้ตั้งค่าโต๊ะ'}</p>:null}<div className="restaurant-tables">{tables.filter(t=>(canManage||t.enabled)&&(!zone||t.zone===zone)).map(table=><article key={table.id} className="restaurant-table" data-open={Boolean(table.bill)} data-disabled={!table.enabled}><button className="restaurant-table-main" disabled={busy||Boolean(error)||!table.enabled} onClick={()=>void open(table)}><Armchair size={27}/><strong>{table.name}</strong><small>{table.zone||'ไม่ระบุโซน'} · {table.seats} ที่นั่ง</small><span>{!table.enabled?'ปิดใช้งาน':table.bill?'มีบิลเปิดอยู่':'ว่าง'}</span>{table.bill?<b>฿{table.bill.totalAmount}</b>:null}</button>{canManage?<button className="secondary restaurant-table-edit" disabled={busy||Boolean(table.bill)} onClick={()=>setEditor(table)} aria-label={`ตั้งค่าโต๊ะ ${table.name}`}><Settings2 size={16}/>ตั้งค่าโต๊ะ</button>:null}</article>)}</div></>}
 {editor?<TableEditor table={editor===true?undefined:editor} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);reload();}}/>:null}
 {cash&&bill?<RestaurantCashDialog key={bill.id} bill={bill} scope={scope} onClose={()=>setCash(false)} onPaid={()=>{setSelected('');reload();}} onPrintStatus={setStatus}/>:null}
 </div>;
}

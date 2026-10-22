import {useActionError} from '../../lib/use-action-feedback';
import {useState} from 'react';
import type {RestaurantBill,RestaurantRound} from '@pos/contracts/restaurant';
import {Modal} from '../../components/Modal';
import {Busy,Notice} from '../../components/Notice';
import {LabelText} from '../../components/LabelText';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {CafeItemDetails} from '../cafe-options/CafeItemDetails';
import {cancelBill,cancelRound} from './client';
import {printRound} from './print-round';
export function RestaurantBillView({bill,canManage,onAdd,onCash,onChanged,onBack}:{bill:RestaurantBill;canManage:boolean;onAdd:()=>void;onCash:()=>void;onChanged:()=>void;onBack:()=>void}){
 const [cancelling,setCancelling]=useState<RestaurantRound|null>(null),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 const active=bill.rounds.filter(r=>!r.cancelled);
 return <section className="restaurant-bill"><div className="restaurant-toolbar"><div><h2>โต๊ะ {bill.tableName}</h2><small>เปิดบิล {new Date(bill.openedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small></div><button className="secondary" disabled={busy} onClick={onBack}>กลับไปโต๊ะทั้งหมด</button></div>
 <div className="restaurant-bill-total"><span>ยอดอาหารทั้งหมด</span><strong>฿{bill.totalAmount}</strong></div><div className="category-actions"><button className="primary" disabled={busy} onClick={onAdd}>เพิ่มอาหาร</button><button className="primary" disabled={busy||!active.length} onClick={onCash}>คิดเงิน</button><button className="secondary danger" disabled={busy||Boolean(active.length)} onClick={async()=>{if(!await confirmAlert('ปิดโต๊ะที่ไม่มีออเดอร์ใช้งานอยู่หรือไม่?'))return;setBusy(true);try{await cancelBill(bill.id,bill.version);await successAlert('ปิดโต๊ะแล้ว');onBack();onChanged();}catch(e){setError(authMessage(e));}finally{setBusy(false);}}}>ปิดโต๊ะว่าง</button></div>
 {error?<Notice>{error}</Notice>:null}{!bill.rounds.length?<p className="restaurant-empty">ยังไม่มีออเดอร์ กดเพิ่มอาหารเพื่อเริ่มรอบแรก</p>:null}
 {bill.rounds.map(round=><article className="restaurant-round" key={round.id} data-cancelled={round.cancelled}><div className="restaurant-toolbar"><h3>รอบที่ {round.number} {round.cancelled?'· ยกเลิกแล้ว':''}</h3><small>{new Date(round.createdAt).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'})}</small></div>{round.items.map(i=><div key={i.lineId} className="restaurant-order-line"><div><strong>{i.name}</strong><CafeItemDetails item={i}/></div><span>× {i.quantity}</span><strong>฿{i.lineTotal}</strong></div>)}{round.cancelled?<p className="hint">เหตุผล: {round.cancelReason}</p>:<div className="category-actions"><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await printRound(bill,round,true);}catch(e){await warningAlert(authMessage(e));}finally{setBusy(false);}}}>พิมพ์ใบเตรียมซ้ำ</button>{canManage?<button className="secondary danger" disabled={busy} onClick={()=>setCancelling(round)}>ยกเลิกรอบนี้</button>:null}</div>}</article>)}
 {cancelling?<CancelRoundDialog bill={bill} round={cancelling} onClose={()=>setCancelling(null)} onDone={()=>{setCancelling(null);onChanged();}}/>:null}</section>;
}
function CancelRoundDialog({bill,round,onClose,onDone}:{bill:RestaurantBill;round:RestaurantRound;onClose:()=>void;onDone:()=>void}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 return <Modal title={`ยกเลิกออเดอร์รอบ ${round.number}`} busy={busy} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();if(!await confirmAlert('ยกเลิกอาหารทั้งหมดในรอบนี้หรือไม่?',true))return;setBusy(true);try{await cancelRound(bill.id,round.id,bill.version,reason);await successAlert('ยกเลิกออเดอร์แล้ว');onDone();}catch(e){setError(authMessage(e));}finally{setBusy(false);}}}><label><LabelText required>เหตุผล</LabelText><textarea required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>กลับ</button><button className="secondary danger" disabled={busy||!reason.trim()}>{busy?<Busy/>:null}ยืนยันยกเลิก</button></div></form></Modal>;
}

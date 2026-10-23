import {useActionError} from '../../lib/use-action-feedback';
import {useState} from 'react';
import type {RestaurantBill,RestaurantRound} from '@pos/contracts/restaurant';
import {Modal} from '../../components/Modal';
import {Busy,Notice} from '../../components/Notice';
import {LabelText} from '../../components/LabelText';
import {authMessage} from '../../lib/client';
import {confirmAlert,successAlert,printWarningAlert} from '../../lib/alerts';
import {CafeItemDetails} from '../cafe-options/CafeItemDetails';
import {cancelBill,cancelRound} from './client';
import {printRound} from './print-round';
export function RestaurantRoundHistory({bill,canManage,onChanged}:{bill:RestaurantBill;canManage:boolean;onChanged:()=>void}){
 const [cancelling,setCancelling]=useState<RestaurantRound|null>(null),[busy,setBusy]=useState(false);
 return <details className="restaurant-round-history"><summary>ประวัติออเดอร์ที่ส่งแล้ว · {bill.rounds.length} รอบ</summary>
 {bill.rounds.map(round=><article className="restaurant-round" key={round.id} data-cancelled={round.cancelled}><div className="restaurant-toolbar"><h3>รอบที่ {round.number} {round.source==='GUEST'?'· ลูกค้าสั่งผ่าน QR ':''}{round.cancelled?'· ยกเลิกแล้ว':''}</h3><small>{new Date(round.createdAt).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'})}</small></div>{round.items.map(i=><div key={i.lineId} className="restaurant-order-line"><div><strong>{i.name}</strong><CafeItemDetails item={i}/></div><span>× {i.quantity}</span><strong>฿{i.lineTotal}</strong></div>)}{round.cancelled?<p className="hint">เหตุผล: {round.cancelReason}</p>:<div className="category-actions"><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await printRound(bill,round,true);}catch(e){await printWarningAlert(authMessage(e));}finally{setBusy(false);}}}>พิมพ์ใบเตรียมซ้ำ</button>{canManage?<button className="secondary danger" disabled={busy} onClick={()=>setCancelling(round)}>ยกเลิกรอบนี้</button>:null}</div>}</article>)}
 {cancelling?<CancelRoundDialog bill={bill} round={cancelling} onClose={()=>setCancelling(null)} onDone={()=>{setCancelling(null);onChanged();}}/>:null}</details>;
}
function CancelRoundDialog({bill,round,onClose,onDone}:{bill:RestaurantBill;round:RestaurantRound;onClose:()=>void;onDone:()=>void}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useActionError();
 return <Modal title={`ยกเลิกออเดอร์รอบ ${round.number}`} busy={busy} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();if(!await confirmAlert('ยกเลิกอาหารทั้งหมดในรอบนี้หรือไม่?',true))return;setBusy(true);try{await cancelRound(bill.id,round.id,bill.version,reason);await successAlert('ยกเลิกออเดอร์แล้ว');onDone();}catch(e){setError(authMessage(e));}finally{setBusy(false);}}}><label><LabelText required>เหตุผล</LabelText><textarea required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>กลับ</button><button className="secondary danger" disabled={busy||!reason.trim()}>{busy?<Busy/>:null}ยืนยันยกเลิก</button></div></form></Modal>;
}

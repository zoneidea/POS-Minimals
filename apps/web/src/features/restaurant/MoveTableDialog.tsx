import {useState} from 'react';
import {z} from 'zod';
import type {RestaurantBill,RestaurantTable} from '@pos/contracts/restaurant';
import {Modal} from '../../components/Modal';
import {DestinationTableGrid} from './DestinationTableGrid';
import {Busy,Notice} from '../../components/Notice';
import {confirmAlert,successAlert} from '../../lib/alerts';
import {useRestaurantAttempt} from './use-restaurant-attempt';
import {moveTable} from './client';
const input=z.object({targetId:z.uuid(),version:z.number().int().positive(),key:z.uuid()}).strict();
export function MoveTableDialog({bill,tables,scope,onClose,onMoved}:{bill:RestaurantBill;tables:RestaurantTable[];scope:string;onClose:()=>void;onMoved:(bill:RestaurantBill)=>void}){
 const [target,setTarget]=useState('');
 const attempt=useRestaurantAttempt(`pos:restaurant-move:${scope}:${bill.id}`,input,value=>moveTable(bill.id,value),async value=>{onMoved(value);onClose();await successAlert('ย้ายโต๊ะแล้ว');});
 const available=tables.filter(t=>t.enabled&&!t.bill&&t.id!==bill.tableId);
 return <Modal title={`ย้ายโต๊ะ ${bill.tableName}`} onClose={onClose} busy={attempt.busy}><form onSubmit={async e=>{e.preventDefault();if(attempt.pending){await attempt.submit(attempt.pending);return;}if(!available.some(t=>t.id===target))return;if(!await confirmAlert(`ย้ายบิลโต๊ะ ${bill.tableName} ไปโต๊ะ ${tables.find(t=>t.id===target)?.name??''} หรือไม่?`))return;await attempt.submit({targetId:target,version:bill.version,key:crypto.randomUUID()});}}><p className="hint">รายการอาหารและ QR สั่งอาหารเดิมจะติดตามบิลไปโต๊ะใหม่</p><DestinationTableGrid tables={tables.filter(t=>available.includes(t)||t.id===attempt.pending?.targetId)} selected={attempt.pending?.targetId??target} disabled={Boolean(attempt.pending)||attempt.busy||attempt.blocked} onSelect={setTarget}/>{!available.length&&!attempt.pending?<p className="hint">ไม่มีโต๊ะว่างที่เปิดใช้งาน</p>:null}{attempt.error?<Notice>{attempt.error}</Notice>:null}<div className="modal-actions"><button className="secondary" type="button" disabled={attempt.busy} onClick={onClose}>ปิด</button><button className="primary" disabled={attempt.busy||attempt.blocked||(!available.some(t=>t.id===target)&&!attempt.pending)}>{attempt.busy?<Busy/>:null}{attempt.pending?'ตรวจสอบการย้ายเดิม':'ยืนยันย้ายโต๊ะ'}</button></div></form></Modal>;
}

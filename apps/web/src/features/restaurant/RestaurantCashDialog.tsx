import {restaurantCashInput,type RestaurantBill} from '@pos/contracts/restaurant';
import {useState} from 'react';
import {Modal} from '../../components/Modal';
import {Busy,Notice} from '../../components/Notice';
import {CashPayment} from '../pos/CashPayment';
import {parseAmount,amountInput} from '../pos/checkout-amounts';
import {completeCheckout} from '../pos/complete-checkout';
import {useRestaurantAttempt} from './use-restaurant-attempt';
import {payCash} from './client';
export function RestaurantCashDialog({bill,scope,onClose,onPaid,onPrintStatus}:{bill:RestaurantBill;scope:string;onClose:()=>void;onPaid:()=>void;onPrintStatus:(value:string)=>void}){
 const [received,setReceived]=useState('0');
 const attempt=useRestaurantAttempt(`${scope}:restaurant:cash:${bill.id}`,restaurantCashInput,input=>payCash(bill.id,input),sale=>completeCheckout(sale,true,{close:onClose,clear:onPaid,status:onPrintStatus}));
 const due=parseAmount(bill.totalAmount)!,amount=parseAmount(received),valid=amount!==null&&amount>=due;
 return <Modal title={`รับเงิน · โต๊ะ ${bill.tableName}`} busy={attempt.busy} onClose={onClose}><div className="restaurant-cash"><p>ยอดชำระ <strong>฿{bill.totalAmount}</strong></p><p className="hint">รับเงินสดทั้งบิล · ระบบตรวจสต็อกอีกครั้งและปิดโต๊ะเมื่อบันทึกสำเร็จ</p>
 {attempt.pending?<p className="notice">มีคำขอรับเงินที่ยังไม่ยืนยันผล กรุณาตรวจสอบรายการเดิมก่อนรับเงินซ้ำ</p>:<CashPayment received={received} onChange={setReceived} due={due}/>}
 {attempt.error?<Notice>{attempt.error}</Notice>:null}<div className="category-actions"><button className="secondary" disabled={attempt.busy} onClick={onClose}>กลับไปโต๊ะ</button><button className="primary" disabled={attempt.busy||attempt.blocked||(!attempt.pending&&!valid)} onClick={()=>void attempt.submit(attempt.pending??{key:crypto.randomUUID(),version:bill.version,receivedAmount:amountInput(amount!),totalAmount:bill.totalAmount})}>{attempt.busy?<Busy/>:null}{attempt.pending?'ตรวจสอบคำขอเดิม':'รับเงินและพิมพ์ใบเสร็จ'}</button></div></div></Modal>;
}

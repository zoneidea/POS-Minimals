import {useEffect,useState} from 'react';
import {restaurantCashInput,type RestaurantBill} from '@pos/contracts/restaurant';
import {Banknote} from 'lucide-react';
import type {CompletedSale} from '../pos/checkout-client';
import {CheckoutFrame} from '../pos/CheckoutFrame';
import {CheckoutTotals} from '../pos/CheckoutTotals';
import {CashPayment} from '../pos/CashPayment';
import {useCashQuote} from '../pos/use-cash-quote';
import {parseAmount,amountInput} from '../pos/checkout-amounts';
import {CouponEntry} from '../coupons/CouponEntry';
import {useModuleAccess} from '../marketplace/ModuleAccess';
import {useCheckoutCustomerDisplay} from '../customer-display/CustomerDisplayProvider';
import {Busy,Notice} from '../../components/Notice';
import {useRestaurantAttempt} from './use-restaurant-attempt';
import {payCash} from './client';
import {billCartItems,restaurantCashKey} from './bill-cart';
export function RestaurantCheckoutModal({bill,scope,onClose,onSuccess}:{bill:RestaurantBill;scope:string;onClose:()=>void;onSuccess:(sale:CompletedSale)=>void}){
 const modules=useModuleAccess();const [initial]=useState(()=>{try{const raw=localStorage.getItem(restaurantCashKey(scope,bill.id));return raw?restaurantCashInput.parse(JSON.parse(raw)):null;}catch{return null;}});
 const [discount,setDiscount]=useState(initial?.discountAmount??'0'),[coupon,setCoupon]=useState(initial?.couponCode??''),[received,setReceived]=useState(initial?.receivedAmount??'0');
 const attempt=useRestaurantAttempt(restaurantCashKey(scope,bill.id),restaurantCashInput,input=>payCash(bill.id,input),onSuccess);
 useEffect(()=>{if(!modules.loading&&!modules.coupons&&!attempt.pending&&!attempt.busy)setCoupon('');},[modules.loading,modules.coupons,attempt.pending,attempt.busy]);
 const items=billCartItems(bill),quoted=useCashQuote(items,discount,!attempt.pending,coupon||undefined,{billId:bill.id,version:bill.version}),q=quoted.quote;
 const due=attempt.pending?parseAmount(attempt.pending.totalAmount):q?parseAmount(q.totalAmount):null,amount=parseAmount(received),d=parseAmount(discount),busy=attempt.busy,locked=Boolean(attempt.pending),canPay=Boolean(q&&due!==null&&amount!==null&&amount>=due&&!quoted.pending&&!quoted.error&&d!==null&&!attempt.blocked);
 useCheckoutCustomerDisplay({items,quote:q,due,received:amount,mode:'cash',pending:quoted.pending||Boolean(quoted.error)});
 return <CheckoutFrame title={`Checkout — ชำระเงิน · โต๊ะ ${bill.tableName}`} busy={busy} onClose={onClose}
 feedback={<>{attempt.error?<Notice>{attempt.error}</Notice>:null}{attempt.pending?<div className="notice"><p>ยังยืนยันผลรายการเดิมไม่ได้ กรุณาตรวจสอบก่อนรับเงินซ้ำ</p><code>{attempt.pending.key}</code><button className="secondary" disabled={busy} onClick={()=>void attempt.submit(attempt.pending!)}>ตรวจสอบผลรายการเดิม</button></div>:null}</>}
 summary={<>{quoted.pending?<p role="status"><Busy/>กำลังตรวจสอบยอดล่าสุด</p>:null}{quoted.error?<><Notice>{quoted.error}</Notice><button className="secondary" onClick={quoted.reload}>ลองคำนวณใหม่</button></>:null}<fieldset className="checkout-fieldset" disabled={locked}>{modules.coupons?<CouponEntry code={coupon} onApply={setCoupon} busy={busy} discount={q?.couponDiscountAmount}/>:null}<CheckoutTotals subtotal={parseAmount(q?.subtotalAmount??bill.totalAmount)!} discount={discount} onDiscount={setDiscount} due={due} loading={quoted.pending} vat={q?{amount:q.vatAmount,enabled:q.vatEnabled,rate:q.vatRate}:undefined}/>{coupon&&q?.couponDiscountAmount?<p className="coupon-applied">ส่วนลดรวมคูปอง ฿{q.discountAmount}</p>:null}</fieldset></>}
 payment={<><div className="order-modes" role="group" aria-label="วิธีชำระเงิน"><button aria-pressed="true"><Banknote size={16}/>เงินสด</button></div><fieldset className="checkout-fieldset" disabled={locked}><CashPayment received={received} onChange={setReceived} due={due}/></fieldset></>}
 actions={<><button className="secondary" onClick={onClose}>กลับไปตะกร้า</button><button className="primary" disabled={!canPay||locked} onClick={()=>{if(!q||amount===null||d===null)return;void attempt.submit({version:bill.version,key:crypto.randomUUID(),receivedAmount:amountInput(amount),totalAmount:q.totalAmount,discountAmount:amountInput(d),...(coupon?{couponCode:coupon}:{})});}}>ยืนยันขายเงินสด</button></>}
 footer="รายการอาหารอ้างอิงจากบิลโต๊ะ · คืนโต๊ะว่างเมื่อบันทึกการขายสำเร็จ"/>;
}

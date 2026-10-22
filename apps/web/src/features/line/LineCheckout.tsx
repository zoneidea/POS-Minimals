import {cartLineKey,quoteLine,checkoutLine} from '../cafe-options/cart-lines';
import {sameGatewayCart} from '../payments/gateway-cart';
import {useEffect,useRef,useState} from 'react';
import {Modal} from '../../components/Modal';
import {CashPayment} from '../pos/CashPayment';
import {CheckoutTotals} from '../pos/CheckoutTotals';
import {parseAmount,amountInput} from '../pos/checkout-amounts';
import {cartTotal,type CartItem} from '../pos/cart';
import {lineApi,lineMessage} from './api';
import {linePendingKey,readLinePending} from './storage';
import {submitLineOperation,recoverLineOperation,knownRejectedLineOperation} from './cash-operation';
import type {LineQuote,LineSale,LinePending} from './schema';
import {recordLineEvent} from './diagnostics';
export function LineCheckout({scope,items,onClose,onSuccess,onLocked}:{scope:string;items:CartItem[];onClose:()=>void;onSuccess:(sale:LineSale,sameCart:boolean)=>void;onLocked:(value:boolean)=>void}){
 const [discount,setDiscount]=useState('0'),[received,setReceived]=useState('0'),[coupon,setCoupon]=useState(''),[couponDraft,setCouponDraft]=useState(''),[coupons,setCoupons]=useState(false),[moduleError,setModuleError]=useState(false),[quote,setQuote]=useState<LineQuote|null>(null),[error,setError]=useState(''),[pending,setPending]=useState<LinePending|null>(null),[storageReady,setStorageReady]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[accepted,setAccepted]=useState(''),[revision,setRevision]=useState(0);
 const running=useRef(false),pendingReadFailed=useRef(false);
 useEffect(()=>{try{setPending(readLinePending(scope));setStorageReady(true);}catch{pendingReadFailed.current=true;setError('อ่านรายการขายที่รอยืนยันไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บก่อนทำรายการใหม่');}const c=new AbortController();lineApi.entitlements(c.signal).then(value=>{if(!c.signal.aborted)setCoupons(value.coupons);}).catch(()=>{if(!c.signal.aborted)setModuleError(true);});return()=>c.abort();},[scope]);
 useEffect(()=>{onLocked(busy||Boolean(pending)||!storageReady);return()=>onLocked(false);},[busy,pending,storageReady,onLocked]);
 const discountAmount=parseAmount(discount),query=discountAmount!==null&&items.length?JSON.stringify({items:items.map(quoteLine),discountAmount:amountInput(discountAmount),paymentMethod:'CASH',...(coupon?{couponCode:coupon}:{})}):'';
 useEffect(()=>{setQuote(null);setAccepted('');if(!storageReady||!query||pending)return;const c=new AbortController();setLoading(true);setError('');const timer=setTimeout(()=>{lineApi.quote(JSON.parse(query),c.signal).then(value=>{if(!c.signal.aborted)setQuote(value);}).catch(e=>{if(!c.signal.aborted)setError(lineMessage(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},300);return()=>{clearTimeout(timer);c.abort();};},[query,pending,revision,storageReady]);
 const priceChanged=Boolean(quote?.items.some(row=>items.find(item=>cartLineKey(item)===(row.lineId??row.productId))?.salePrice!==row.unitPrice));
 const due=quote&&(!priceChanged||accepted===quote.quoteFingerprint)?parseAmount(quote.totalAmount):null,receivedAmount=parseAmount(received);
 const canSubmit=Boolean(storageReady&&!pending&&!busy&&!loading&&quote&&due!==null&&receivedAmount!==null&&receivedAmount>=due);
 async function execute(recover=false){if(running.current||(!recover&&!canSubmit)||!storageReady)return;running.current=true;setBusy(true);setError('');let operation=pending;
 try{
 if(recover){if(!operation)return;}else{if(!quote||receivedAmount===null||discountAmount===null)return;operation={key:crypto.randomUUID(),input:{items:quote.items.map(checkoutLine),discountAmount:amountInput(discountAmount),...(coupon?{couponCode:coupon}:{}),expectedTotalAmount:quote.totalAmount,payment:{method:'CASH',receivedAmount:amountInput(receivedAmount)}}};localStorage.setItem(linePendingKey(scope),JSON.stringify(operation));setPending(operation);}
 const sale=recover?await recoverLineOperation(operation!,lineApi):await submitLineOperation(scope,operation!,lineApi,localStorage);
 // A storage cleanup failure must not turn a committed bill into another checkout.
 try{localStorage.removeItem(linePendingKey(scope));}catch{/* Recovering this same key will return the same bill. */}
 const same=sameGatewayCart({items:items.map(quoteLine),discountAmount:operation!.input.discountAmount,couponCode:operation!.input.couponCode},operation!.input)&&items.every(item=>operation!.input.items.some(i=>(i.lineId??i.productId)===cartLineKey(item)&&i.expectedUnitPrice===item.salePrice));
 recordLineEvent({event:'SALE_CONFIRMED'});onSuccess(sale,same);
 }catch(e){if(knownRejectedLineOperation(e)){try{localStorage.removeItem(linePendingKey(scope));setPending(null);setRevision(v=>v+1);}catch{/* Keep recovery state when cleanup fails. */}}setError(lineMessage(e));}finally{running.current=false;setBusy(false);}}
 return <Modal title="ชำระเงิน" busy={busy||Boolean(pending)||!storageReady} onClose={onClose}><div className="line-checkout"><span className="line-payment-label">เงินสด</span>{error?<p className="line-notice" role="alert">{error}</p>:null}{pending?<section className="line-notice"><p>มีรายการขายที่ยังรอยืนยัน กรุณาตรวจสอบผลรายการเดิมก่อน</p><p>ยอด ฿{pending.input.expectedTotalAmount} · รับเงิน ฿{pending.input.payment.receivedAmount}</p><button className="line-primary" disabled={busy} onClick={()=>void execute(true)}>{busy?'กำลังตรวจสอบ':'ตรวจสอบผลรายการเดิม'}</button></section>:null}<fieldset disabled={busy||Boolean(pending)||!storageReady}>
 {loading?<p role="status">กำลังตรวจสอบยอดล่าสุด</p>:null}
 {priceChanged&&quote?<label className="line-notice"><input type="checkbox" checked={accepted===quote.quoteFingerprint} onChange={e=>setAccepted(e.target.checked?quote.quoteFingerprint:'')}/>ราคาสินค้าเปลี่ยน กรุณายอมรับราคาจากเซิร์ฟเวอร์ก่อนขาย</label>:null}
 <CheckoutTotals subtotal={quote?parseAmount(quote.subtotalAmount)!:cartTotal(items)} discount={discount} onDiscount={setDiscount} due={due} loading={loading} vat={quote?{amount:quote.vatAmount,enabled:quote.vatEnabled,rate:quote.vatRate}:undefined}/>
 {coupons?<div className="line-coupon"><label>โค้ดคูปอง<input aria-label="โค้ดคูปอง" value={couponDraft} maxLength={32} onChange={e=>setCouponDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,''))}/></label><button className="line-secondary" onClick={()=>setCoupon(couponDraft)}>ใช้คูปอง</button>{coupon?<button className="line-secondary" onClick={()=>{setCoupon('');setCouponDraft('');}}>เอาคูปองออก</button>:null}</div>:null}{moduleError?<p className="line-muted">ไม่สามารถโหลดสิทธิ์คูปองได้</p>:null}{coupon&&quote?.couponDiscountAmount?<p>ส่วนลดคูปอง ฿{quote.couponDiscountAmount}</p>:null}
 <CashPayment received={received} onChange={setReceived} due={due}/>
 <button className="line-primary line-confirm" disabled={!canSubmit} onClick={()=>void execute()}>{busy?'กำลังบันทึก':'ยืนยันขายเงินสด'}</button>
 </fieldset>{!pending&&!busy&&storageReady?<button className="line-secondary" onClick={onClose}>กลับไปตะกร้า</button>:null}{error&&!pending&&!pendingReadFailed.current?<button className="line-secondary" disabled={busy} onClick={()=>setRevision(v=>v+1)}>ตรวจสอบยอดอีกครั้ง</button>:null}</div></Modal>;
}

import {useCheckoutCustomerDisplay} from '../customer-display/CustomerDisplayProvider';
import {useModuleAccess} from '../marketplace/ModuleAccess';
import {CouponEntry} from '../coupons/CouponEntry';
import {readGatewayPending} from '../payments/gateway-pending';
import type {CompletedSale} from './checkout-client';
import {confirmAlert} from '../../lib/alerts';
import {PromptPayPayment} from '../payments/PromptPayPayment';
import { useCashCheckout } from './use-cash-checkout';
import { amountInput } from './checkout-amounts';
import { useCashQuote } from './use-cash-quote';
import { Notice,Busy } from '../../components/Notice';
import { useEffect,useState } from 'react';
import { Banknote } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CashPayment } from './CashPayment';
import { CheckoutTotals } from './CheckoutTotals';
import { parseAmount } from './checkout-amounts';
import { cartTotal,type CartItem } from './cart';
export function CheckoutModal({items,scope,onClose,onSuccess}:{items:CartItem[];scope:string;onClose:()=>void;onSuccess:(sale:CompletedSale,sameCart?:boolean)=>void}) {
 const modules=useModuleAccess(),[couponCode,setCouponCode]=useState(()=>readGatewayPending(scope)?.cart.couponCode??'');
 const [mode,setMode]=useState(()=>readGatewayPending(scope)?'promptpay':'cash'),[discount,setDiscount]=useState(()=>readGatewayPending(scope)?.cart.discountAmount??'0'),[received,setReceived]=useState('0'),[accepted,setAccepted]=useState('');
 const [gatewayLocked,setGatewayLocked]=useState(()=>Boolean(readGatewayPending(scope)));
 const close=async()=>{if(!gatewayLocked||await confirmAlert('ยกเลิกการรอชำระเงินและกลับไปตะกร้าหรือไม่?'))onClose();};
 const checkout=useCashCheckout(scope,onSuccess);
 useEffect(()=>{if(!modules.loading&&!modules.coupons&&!gatewayLocked&&!checkout.attempt&&!checkout.busy)setCouponCode('');},[modules.loading,modules.coupons,gatewayLocked,checkout.attempt,checkout.busy]);
 const quoteState=useCashQuote(items,discount,true,couponCode||undefined);
 const [gatewayQuote,setGatewayQuote]=useState<typeof quoteState.quote>();
 const quote=gatewayQuote??quoteState.quote;
 const priceChanged=Boolean(quote?.items.some(row=>items.find(item=>item.id===row.productId)?.salePrice!==row.unitPrice));
 const subtotal=quote?parseAmount(quote.subtotalAmount)!:cartTotal(items),discountAmount=parseAmount(discount);
 const due=quote&&(!priceChanged||accepted===quote.quoteFingerprint)?parseAmount(quote.totalAmount):null;
 const receivedAmount=parseAmount(received),canSubmit=Boolean(mode==='cash'&&items.length&&quote&&due!==null&&receivedAmount!==null&&receivedAmount>=due&&!checkout.attempt&&!checkout.busy);
 useCheckoutCustomerDisplay({items,quote,due,received:receivedAmount,mode,pending:(!gatewayLocked&&quoteState.pending)||Boolean(quoteState.error)});
 return <Modal title="Checkout — ชำระเงิน" busy={checkout.busy||Boolean(checkout.attempt)} onClose={()=>void close()}>
 {checkout.error?<Notice>{checkout.error}</Notice>:null}
 {checkout.attempt?<div className="notice"><p>ยังยืนยันผลรายการเดิมไม่ได้ กรุณาตรวจสอบก่อนทำรายการใหม่</p><code>{checkout.attempt.key}</code><button className="secondary" disabled={checkout.busy} onClick={()=>void checkout.recover()}>{checkout.busy?<Busy/>:null}ตรวจสอบผลรายการเดิม</button></div>:checkout.error?<button className="secondary" onClick={quoteState.reload}>ตรวจสอบยอดล่าสุด</button>:null}
 <fieldset disabled={checkout.busy||Boolean(checkout.attempt)} className="checkout-fieldset"><div className="checkout-modal">
 <div className="checkout-summary"> {items.length===0?<p className="cart-note">ยังไม่มีสินค้าในตะกร้า กรุณาเลือกสินค้าก่อนยืนยันขาย</p>:null}
{quoteState.pending?<p role="status"><Busy/>กำลังตรวจสอบยอดล่าสุด</p>:null}
 {quoteState.error?<><Notice>{quoteState.error}</Notice><button className="secondary" onClick={quoteState.reload}>ลองคำนวณใหม่</button></>:null}
 {priceChanged&&quote?<Notice>ราคาสินค้าเปลี่ยนแล้ว: {quote.items.filter(row=>items.find(item=>item.id===row.productId)?.salePrice!==row.unitPrice).map(row=>`${row.name} ฿${row.unitPrice}`).join(', ')}<label><input type="checkbox" checked={accepted===quote.quoteFingerprint} onChange={event=>setAccepted(event.target.checked?quote.quoteFingerprint:'')}/>ยอมรับราคาล่าสุด</label></Notice>:null}
 {modules.coupons?<CouponEntry code={couponCode} onApply={code=>{setCouponCode(code);setAccepted('');}} busy={gatewayLocked||checkout.busy} discount={quote?.couponDiscountAmount}/>:null}
 <fieldset className="checkout-fieldset" disabled={gatewayLocked}><CheckoutTotals subtotal={subtotal} discount={discount} onDiscount={setDiscount} due={due} loading={quoteState.pending||discountAmount!==null} vat={quote?{amount:quote.vatAmount,enabled:quote.vatEnabled,rate:quote.vatRate}:undefined}/></fieldset>{quote?.couponDiscountAmount&&couponCode?<p className="coupon-applied">ส่วนลดรวมคูปอง ฿{quote.discountAmount}</p>:null}
 </div><div className="checkout-payment"><div className="order-modes" role="group" aria-label="วิธีชำระเงิน"><button disabled={gatewayLocked} aria-pressed={mode==='cash'} onClick={()=>setMode('cash')}><Banknote size={16}/>เงินสด</button><button disabled={gatewayLocked} aria-pressed={mode==='promptpay'} onClick={()=>setMode('promptpay')}>PromptPay</button></div>
 {mode==='cash'?<CashPayment received={received} onChange={setReceived} due={due}/>:<PromptPayPayment scope={scope} onCompleted={(sale,sameCart)=>onSuccess(sale,sameCart)} amount={due===null||(!gatewayLocked&&quoteState.pending)?undefined:amountInput(due)} onLock={locked=>{if(locked)setGatewayQuote(quote);setGatewayLocked(locked);}} cart={{...(couponCode?{couponCode}:{}),items:items.map(item=>({productId:item.id,quantity:item.quantity})),discountAmount:discountAmount===null?'0.00':amountInput(discountAmount)}}/>}
</div><div className="category-actions"><button className="secondary" onClick={()=>void close()}>กลับไปตะกร้า</button>{mode==='cash'?<button className="primary" disabled={!canSubmit} onClick={()=>{if(!quote||receivedAmount===null||!canSubmit)return;void checkout.submit({items:quote.items.map(row=>({productId:row.productId,quantity:row.quantity,expectedUnitPrice:row.unitPrice,expectedVersion:row.expectedVersion})),discountAmount:discountAmount===null?'0.00':amountInput(discountAmount),...(couponCode?{couponCode}:{}),expectedTotalAmount:quote.totalAmount,payment:{method:'CASH',receivedAmount:amountInput(receivedAmount)}});}}>ยืนยันขายเงินสด</button>:null}</div><p className="cart-note">{quote?'ยอดชำระตรวจสอบจากเซิร์ฟเวอร์แล้ว · ยังไม่จองสต็อกหรือบันทึกขาย':'รอการตรวจสอบยอดจากเซิร์ฟเวอร์'}</p></div></fieldset></Modal>;
}

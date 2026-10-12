import { useCashCheckout } from './use-cash-checkout';
import { SaleReceipt } from './SaleReceipt';
import { amountInput } from './checkout-amounts';
import { useCashQuote } from './use-cash-quote';
import { Notice,Busy } from '../../components/Notice';
import { useState } from 'react';
import { Banknote } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CashPayment } from './CashPayment';
import { CheckoutTotals } from './CheckoutTotals';
import { parseAmount } from './checkout-amounts';
import { cartTotal,type CartItem } from './cart';
export function CheckoutModal({items,scope,onClose,onSuccess}:{items:CartItem[];scope:string;onClose:()=>void;onSuccess:()=>void}) {
 const [mode,setMode]=useState('cash'),[discount,setDiscount]=useState('0'),[received,setReceived]=useState('0'),[accepted,setAccepted]=useState('');
 const checkout=useCashCheckout(scope,onSuccess);
 const quoteState=useCashQuote(items,discount,mode==='cash'),quote=quoteState.quote;
 const priceChanged=Boolean(quote?.items.some(row=>items.find(item=>item.id===row.productId)?.salePrice!==row.unitPrice));
 const subtotal=quote?parseAmount(quote.subtotalAmount)!:cartTotal(items),discountAmount=parseAmount(discount);
 const due=quote&&(!priceChanged||accepted===quote.quoteFingerprint)?parseAmount(quote.totalAmount):null;
 const receivedAmount=parseAmount(received),canSubmit=Boolean(mode==='cash'&&items.length&&quote&&due!==null&&receivedAmount!==null&&receivedAmount>=due&&!checkout.attempt&&!checkout.busy);
 if(checkout.sale)return <Modal title="บิลขาย" onClose={onClose}><SaleReceipt sale={checkout.sale} onClose={onClose}/></Modal>;
 return <Modal title="Checkout — ชำระเงิน" busy={checkout.busy||Boolean(checkout.attempt)} onClose={onClose}>
 {checkout.error?<Notice>{checkout.error}</Notice>:null}
 {checkout.attempt?<div className="notice"><p>ยังยืนยันผลรายการเดิมไม่ได้ กรุณาตรวจสอบก่อนทำรายการใหม่</p><code>{checkout.attempt.key}</code><button className="secondary" disabled={checkout.busy} onClick={()=>void checkout.recover()}>{checkout.busy?<Busy/>:null}ตรวจสอบผลรายการเดิม</button></div>:checkout.error?<button className="secondary" onClick={quoteState.reload}>ตรวจสอบยอดล่าสุด</button>:null}
 <fieldset disabled={checkout.busy||Boolean(checkout.attempt)} className="checkout-fieldset"><div className="checkout-modal">
 <div className="checkout-summary"> {items.length===0?<p className="cart-note">ยังไม่มีสินค้าในตะกร้า กรุณาเลือกสินค้าก่อนยืนยันขาย</p>:null}
{quoteState.pending?<p role="status"><Busy/>กำลังตรวจสอบยอดล่าสุด</p>:null}
 {quoteState.error?<><Notice>{quoteState.error}</Notice><button className="secondary" onClick={quoteState.reload}>ลองคำนวณใหม่</button></>:null}
 {priceChanged&&quote?<Notice>ราคาสินค้าเปลี่ยนแล้ว: {quote.items.filter(row=>items.find(item=>item.id===row.productId)?.salePrice!==row.unitPrice).map(row=>`${row.name} ฿${row.unitPrice}`).join(', ')}<label><input type="checkbox" checked={accepted===quote.quoteFingerprint} onChange={event=>setAccepted(event.target.checked?quote.quoteFingerprint:'')}/>ยอมรับราคาล่าสุด</label></Notice>:null}
 <CheckoutTotals subtotal={subtotal} discount={discount} onDiscount={setDiscount} due={due} loading={quoteState.pending||discountAmount!==null} vat={quote?{amount:quote.vatAmount,enabled:quote.vatEnabled,rate:quote.vatRate}:undefined}/>
 </div><div className="checkout-payment"><div className="order-modes" role="group" aria-label="วิธีชำระเงิน"><button aria-pressed={mode==='cash'} onClick={()=>setMode('cash')}><Banknote size={16}/>เงินสด</button><button aria-pressed={mode==='promptpay'} onClick={()=>setMode('promptpay')}>PromptPay</button></div>
 {mode==='cash'?<CashPayment received={received} onChange={setReceived} due={due}/>:<section className="promptpay-payment"><p>QR และยอดชำระจะแสดงหลังได้รับยอดยืนยันจากระบบ</p><p className="cart-note">ระบบยังไม่เชื่อมข้อมูล PromptPay ของร้านและ API คำนวณยอด</p><label><input type="checkbox" disabled/> ยืนยันได้รับเงินแล้วด้วยตนเอง</label><p className="cart-note">ระบบไม่ได้ตรวจสอบเงินเข้าจากธนาคารอัตโนมัติ</p></section>}
</div><div className="category-actions"><button className="secondary" onClick={onClose}>กลับไปตะกร้า</button><button className="primary" disabled={!canSubmit} onClick={()=>{if(!quote||receivedAmount===null||!canSubmit)return;void checkout.submit({items:quote.items.map(row=>({productId:row.productId,quantity:row.quantity,expectedUnitPrice:row.unitPrice,expectedVersion:row.expectedVersion})),discountAmount:quote.discountAmount,expectedTotalAmount:quote.totalAmount,payment:{method:'CASH',receivedAmount:amountInput(receivedAmount)}});}}>ยืนยันขายเงินสด</button></div><p className="cart-note">{quote?'ยอดเงินสดตรวจสอบจากเซิร์ฟเวอร์แล้ว · ยังไม่จองสต็อกหรือบันทึกขาย':'รอการตรวจสอบยอดจากเซิร์ฟเวอร์'}</p></div></fieldset></Modal>;
}

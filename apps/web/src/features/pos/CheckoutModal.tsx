import { useState } from 'react';
import { Banknote } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CashPayment } from './CashPayment';
import { CheckoutTotals } from './CheckoutTotals';
import { parseAmount } from './checkout-amounts';
import { cartTotal,type CartItem } from './cart';
export function CheckoutModal({items,onClose}:{items:CartItem[];onClose:()=>void}) {
 const [mode,setMode]=useState('cash'),[discount,setDiscount]=useState('0'),[received,setReceived]=useState('0');
 const subtotal=cartTotal(items),discountAmount=parseAmount(discount),due=discountAmount!==null&&discountAmount<=subtotal?subtotal-discountAmount:null;
 return <Modal title="Checkout — ชำระเงิน" onClose={onClose}><div className="checkout-modal">
 <div className="checkout-summary"> {items.length===0?<p className="cart-note">ยังไม่มีสินค้าในตะกร้า กรุณาเลือกสินค้าก่อนยืนยันขาย</p>:null}
<CheckoutTotals subtotal={subtotal} discount={discount} onDiscount={setDiscount} due={due}/>
 </div><div className="checkout-payment"><div className="order-modes" role="group" aria-label="วิธีชำระเงิน"><button aria-pressed={mode==='cash'} onClick={()=>setMode('cash')}><Banknote size={16}/>เงินสด</button><button aria-pressed={mode==='promptpay'} onClick={()=>setMode('promptpay')}>PromptPay</button></div>
 {mode==='cash'?<CashPayment received={received} onChange={setReceived} due={due}/>:<section className="promptpay-payment"><p>QR และยอดชำระจะแสดงหลังได้รับยอดยืนยันจากระบบ</p><p className="cart-note">ระบบยังไม่เชื่อมข้อมูล PromptPay ของร้านและ API คำนวณยอด</p><label><input type="checkbox" disabled/> ยืนยันได้รับเงินแล้วด้วยตนเอง</label><p className="cart-note">ระบบไม่ได้ตรวจสอบเงินเข้าจากธนาคารอัตโนมัติ</p></section>}
</div><div className="category-actions"><button className="secondary" onClick={onClose}>กลับไปตะกร้า</button><button className="primary" disabled title="ระบบยืนยันขายอยู่ระหว่างพัฒนา">ยืนยันขาย</button></div><p className="cart-note">ยอดประมาณการ · รอระบบตรวจสอบราคา สต็อก และบันทึกขาย</p></div></Modal>;
}

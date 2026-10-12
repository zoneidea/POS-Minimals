import { CashPayment } from './CashPayment';
import { CheckoutTotals } from './CheckoutTotals';
import { parseAmount } from './checkout-amounts';
import { useState } from 'react';
import { Minus,Plus,Trash2,Banknote,ShoppingCart } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { cartTotal,formatAmount,type CartItem } from './cart';
export function CartPanel({items,onQuantity,onRemove,onClear}:{items:CartItem[];onQuantity:(id:string,delta:number)=>void;onRemove:(id:string)=>void;onClear:()=>void}){
 const [mode,setMode]=useState('cash'),[confirm,setConfirm]=useState(false),[discount,setDiscount]=useState('0'),[received,setReceived]=useState('0');
 const subtotal=cartTotal(items),discountAmount=parseAmount(discount),due=discountAmount!==null&&discountAmount<=subtotal?subtotal-discountAmount:null;
 return <aside className="pos-cart" aria-label="ตะกร้าสินค้า"><h2 className="checkout-heading"><ShoppingCart size={20}/>ตะกร้าและชำระเงิน</h2>
 <div className="cart-lines">{items.length?items.map(item=><div className="cart-line" key={item.id}><div><strong>{item.name}<small className="cart-unit-price">฿{item.salePrice} / ชิ้น</small></strong><span>฿{formatAmount(BigInt(item.salePrice.replace('.',''))*BigInt(item.quantity))}</span></div><div className="cart-quantity"><button aria-label={`นำ ${item.name} ออกจากตะกร้า`} onClick={()=>onRemove(item.id)}><Trash2 size={15}/></button><button aria-label={`ลดจำนวน ${item.name}`} onClick={()=>onQuantity(item.id,-1)}><Minus size={15}/></button><span>{item.quantity}</span><button aria-label={`เพิ่มจำนวน ${item.name}`} disabled={item.quantity>=item.stock} onClick={()=>onQuantity(item.id,1)}><Plus size={15}/></button></div></div>):<div className="cart-empty"><ShoppingCart size={30}/><p>เลือกสินค้าเพื่อเริ่มออเดอร์</p></div>}</div>
 <CheckoutTotals subtotal={subtotal} discount={discount} onDiscount={setDiscount} due={due}/>
 <div className="order-modes" role="group" aria-label="วิธีชำระเงิน"><button aria-pressed={mode==='cash'} onClick={()=>setMode('cash')}><Banknote size={16}/>เงินสด</button><button aria-pressed={mode==='promptpay'} onClick={()=>setMode('promptpay')}>PromptPay</button></div>
 {mode==='cash'?<CashPayment received={received} onChange={setReceived} due={due}/>:<section className="promptpay-payment"><p>QR และยอดชำระจะแสดงหลังได้รับยอดยืนยันจากระบบ</p><p className="cart-note">ระบบยังไม่เชื่อมข้อมูล PromptPay ของร้านและ API คำนวณยอด</p><label><input type="checkbox" disabled/> ยืนยันได้รับเงินแล้วด้วยตนเอง</label><p className="cart-note">ระบบไม่ได้ตรวจสอบเงินเข้าจากธนาคารอัตโนมัติ</p></section>}
 <div className="cart-checkout"><button className="secondary" aria-label="ล้างตะกร้า" disabled={!items.length} onClick={()=>setConfirm(true)}><Trash2 size={18}/></button><button className="pos-pay" disabled title="ระบบยืนยันขายอยู่ระหว่างพัฒนา"><Banknote size={19}/>ยืนยันขาย</button></div><p className="cart-note">ยอดประมาณการ · รอระบบตรวจสอบราคา สต็อก และบันทึกขาย</p>
 {confirm?<Modal title="ล้างตะกร้าสินค้า" onClose={()=>setConfirm(false)}><p>นำสินค้าทั้งหมดออกจากตะกร้าหรือไม่?</p><div className="category-actions"><button className="secondary" onClick={()=>setConfirm(false)}>ยกเลิก</button><button className="primary" onClick={()=>{onClear();setDiscount('0');setReceived('0');setConfirm(false);}}>ยืนยัน</button></div></Modal>:null}
 </aside>;
}

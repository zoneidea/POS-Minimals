import { CheckoutModal } from './CheckoutModal';
import { useState } from 'react';
import { Minus,Plus,Trash2,Banknote,ShoppingCart } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { cartTotal,formatAmount,type CartItem } from './cart';
export function CartPanel({items,onQuantity,onRemove,onClear}:{items:CartItem[];onQuantity:(id:string,delta:number)=>void;onRemove:(id:string)=>void;onClear:()=>void}){
 const [confirm,setConfirm]=useState(false),[checkout,setCheckout]=useState(false);
 const subtotal=cartTotal(items);
 return <aside className="pos-cart" aria-label="ตะกร้าสินค้า"><h2 className="checkout-heading"><ShoppingCart size={20}/>รายการสินค้าที่เลือก</h2>
 <div className="cart-lines" role="region" aria-label="รายการสินค้าในตะกร้า" tabIndex={0}>{items.length?items.map(item=><div className="cart-line" key={item.id}><div><strong>{item.name}<small className="cart-unit-price">฿{item.salePrice} / ชิ้น</small></strong><span>฿{formatAmount(BigInt(item.salePrice.replace('.',''))*BigInt(item.quantity))}</span></div><div className="cart-quantity"><button aria-label={`นำ ${item.name} ออกจากตะกร้า`} onClick={()=>onRemove(item.id)}><Trash2 size={15}/></button><button aria-label={`ลดจำนวน ${item.name}`} onClick={()=>onQuantity(item.id,-1)}><Minus size={15}/></button><span>{item.quantity}</span><button aria-label={`เพิ่มจำนวน ${item.name}`} disabled={item.quantity>=item.stock} onClick={()=>onQuantity(item.id,1)}><Plus size={15}/></button></div></div>):<div className="cart-empty"><ShoppingCart size={30}/><p>เลือกสินค้าเพื่อเริ่มออเดอร์</p></div>}</div>
 <div className="cart-total"><span>{items.reduce((sum,item)=>sum+item.quantity,0)} รายการ</span><strong>฿{formatAmount(subtotal)}</strong></div>
 <div className="cart-checkout"><button className="secondary" aria-label="ล้างตะกร้า" disabled={!items.length} onClick={()=>setConfirm(true)}><Trash2 size={18}/></button><button className="pos-pay" onClick={()=>setCheckout(true)}><Banknote size={19}/>Checkout</button></div>
 {checkout?<CheckoutModal items={items} onClose={()=>setCheckout(false)}/>:null}
 {confirm?<Modal title="ล้างตะกร้าสินค้า" onClose={()=>setConfirm(false)}><p>นำสินค้าทั้งหมดออกจากตะกร้าหรือไม่?</p><div className="category-actions"><button className="secondary" onClick={()=>setConfirm(false)}>ยกเลิก</button><button className="primary" onClick={()=>{onClear();setConfirm(false);}}>ยืนยัน</button></div></Modal>:null}
 </aside>;
}

import {confirmAlert} from '../../lib/alerts';
import { CheckoutModal } from './CheckoutModal';
import { useState } from 'react';
import { Trash2,X,Banknote,ShoppingCart } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { cartTotal,formatAmount,type CartItem } from './cart';
export function CartPanel({items,scope,onSale,onRemove,onClear}:{items:CartItem[];scope:string;onSale:()=>void;onRemove:(id:string)=>void;onClear:()=>void}){
 const [checkout,setCheckout]=useState(false);
 const subtotal=cartTotal(items);
 return <aside className="pos-cart" aria-label="ตะกร้าสินค้า"><h2 className="checkout-heading"><ShoppingCart size={20}/>รายการสินค้าที่เลือก</h2>
 <div className="cart-lines" role="region" aria-label="รายการสินค้าในตะกร้า" tabIndex={0}>{items.length?items.map(item=><div className="cart-line" key={item.id}><div className="cart-line-top"><strong title={item.name}>{item.name}</strong><span className="cart-line-count" aria-label={`จำนวน ${item.name}`}>× {item.quantity}</span><span className="cart-line-amount">{formatAmount(BigInt(item.salePrice.replace('.',''))*BigInt(item.quantity))}</span><button className="cart-remove" aria-label={`นำ ${item.name} ออกจากตะกร้า`} onClick={()=>onRemove(item.id)}><X size={18}/></button></div><small className="cart-unit-price">฿{item.salePrice} / ชิ้น</small></div>):<div className="cart-empty"><ShoppingCart size={30}/><p>เลือกสินค้าเพื่อเริ่มออเดอร์</p></div>}</div>
 <div className="cart-total"><span>{items.reduce((sum,item)=>sum+item.quantity,0)} รายการ</span><strong>฿{formatAmount(subtotal)}</strong></div>
 <div className="cart-checkout"><button className="secondary" aria-label="ล้างตะกร้า" disabled={!items.length} onClick={async()=>{if(await confirmAlert('นำสินค้าทั้งหมดออกจากตะกร้าหรือไม่?',true))onClear();}}><Trash2 size={18}/></button><button className="pos-pay" onClick={()=>setCheckout(true)}><Banknote size={19}/>Checkout</button></div>
 {checkout?<CheckoutModal items={items} scope={scope} onSuccess={onSale} onClose={()=>setCheckout(false)}/>:null}

 </aside>;
}

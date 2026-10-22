import {Banknote,ShoppingCart,X,Send} from 'lucide-react';
import type {RestaurantBill} from '@pos/contracts/restaurant';
import type {CartItem} from '../pos/cart';
import {cartTotal,formatAmount} from '../pos/cart';
import {cartLineKey} from '../cafe-options/cart-lines';
import {CafeItemDetails} from '../cafe-options/CafeItemDetails';
import {Busy,Notice} from '../../components/Notice';
import {billCartItems} from './bill-cart';
export function RestaurantCart({bill,draft,locked,busy,hasPending,error,onRemove,onSend,onCheckout}:{bill:RestaurantBill;draft:CartItem[];locked:boolean;busy:boolean;hasPending:boolean;error?:string;onRemove:(id:string)=>void;onSend:()=>void;onCheckout:()=>void}){
 const sent=billCartItems(bill),quantity=[...sent,...draft].reduce((n,i)=>n+i.quantity,0);
 return <aside className="pos-cart restaurant-order-cart" aria-label={`ตะกร้าโต๊ะ ${bill.tableName}`}><h2 className="checkout-heading"><ShoppingCart size={20}/>โต๊ะ {bill.tableName} <small>{quantity} รายการ</small></h2><div className="cart-lines" role="region" aria-label="ออเดอร์ของโต๊ะ" tabIndex={0}>
 {!sent.length&&!draft.length?<div className="cart-empty"><ShoppingCart size={30}/><p>เลือกเมนูอาหารเพื่อเริ่มออเดอร์</p></div>:null}
 {sent.length?<h3 className="restaurant-cart-section">ออเดอร์ในบิล</h3>:null}{sent.map(i=><div className="cart-line restaurant-confirmed-line" key={i.lineId}><div className="cart-line-top"><strong>{i.name}</strong><span className="cart-line-count">× {i.quantity}</span><span className="cart-line-amount">{formatAmount(BigInt(i.salePrice.replace('.',''))*BigInt(i.quantity))}</span></div><CafeItemDetails item={i}/><small className="restaurant-sent-label">ส่งออเดอร์แล้ว</small></div>)}
 {draft.length?<h3 className="restaurant-cart-section restaurant-draft-heading">รายการใหม่ · ยังไม่ส่ง</h3>:null}{draft.map(i=><div className="cart-line" key={cartLineKey(i)}><div className="cart-line-top"><strong>{i.name}</strong><span className="cart-line-count">× {i.quantity}</span><span className="cart-line-amount">{formatAmount(BigInt(i.salePrice.replace('.',''))*BigInt(i.quantity))}</span><button className="cart-remove" disabled={locked} aria-label={`นำ ${i.name} ออกจากรอบใหม่`} onClick={()=>onRemove(cartLineKey(i))}><X size={18}/></button></div><CafeItemDetails item={i}/></div>)}
 </div><div className="cart-total"><span>ยอดในบิล</span><strong>฿{bill.totalAmount}</strong></div>{draft.length?<p className="restaurant-draft-total">รายการใหม่ ฿{formatAmount(cartTotal(draft))} · ยังไม่รวมในบิล</p>:null}
 {error?<Notice>{error}</Notice>:null}<div className="restaurant-cart-actions"><button className="primary" disabled={busy||(!hasPending&&!draft.length)||locked&&!hasPending} onClick={onSend}>{busy?<Busy/>:<Send size={18}/>} {hasPending?'ตรวจสอบคำขอเดิม':'ส่งออเดอร์ / พิมพ์ใบเตรียม'}</button><button className="pos-pay" disabled={locked||!sent.length||Boolean(draft.length)} onClick={onCheckout}><Banknote size={19}/>คิดเงิน</button></div>{draft.length?<p className="cart-note">ส่งรายการใหม่ก่อนเข้าสู่ Checkout</p>:null}</aside>;
}

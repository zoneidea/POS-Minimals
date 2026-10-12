import { formatAmount } from './cart';
export function CheckoutTotals({subtotal,discount,onDiscount,due,vat,loading}:{subtotal:bigint;discount:string;onDiscount:(value:string)=>void;due:bigint|null;vat?:{amount:string;enabled:boolean;rate:string};loading?:boolean}){
 return <section className="checkout-totals" aria-label="สรุปยอด"><div><span>ยอดรวมสินค้า</span><strong>฿{formatAmount(subtotal)}</strong></div>
 <label className="checkout-field">ส่วนลด (บาท)<input type="number" inputMode="decimal" min="0" step="0.01" value={discount} onChange={event=>onDiscount(event.target.value)}/></label>
 {due===null&&!loading?<p role="alert" className="checkout-error">ส่วนลดต้องไม่ติดลบ ไม่เกินยอดสินค้า และมีทศนิยมไม่เกิน 2 ตำแหน่ง</p>:null}
 <div><span>VAT (รวมในราคาขาย)</span><span className="cart-note">{vat?vat.enabled?`฿${vat.amount} (${vat.rate}%)`:'ไม่คิด VAT':'รอข้อมูลภาษีจากร้าน'}</span></div>
 <div className="cart-total"><span>{vat?'ยอดชำระจากเซิร์ฟเวอร์':'ยอดชำระประมาณการ'}</span><strong>{due===null?'—':`฿${formatAmount(due)}`}</strong></div>
 </section>;
}

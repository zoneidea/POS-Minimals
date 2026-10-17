import {it,expect} from 'vitest';
import {couponReceiptFooter} from '../apps/web/src/features/coupons/receipt-footer';
import {sameGatewayCart} from '../apps/web/src/features/payments/gateway-cart';
it('prints only server-selected receipt offers, escapes text and hides offers on voided receipts',()=>{
 const receipt={couponOffers:[{code:'SAFE10',name:'<script>alert(1)</script>',amount:'10.00',endsOn:'2026-10-18'}]} as any;
 expect(couponReceiptFooter(receipt,false)).toContain('&lt;script&gt;');expect(couponReceiptFooter(receipt,false)).not.toContain('<script>');expect(couponReceiptFooter(receipt,true)).toBe('');expect(couponReceiptFooter({coupon:{code:'HIDDEN'}} as any,false)).toBe('');
});

it('compares restored Gateway carts by their coupon, discount and items rather than JSON property order',()=>{
 const original={couponCode:'SAVE10',items:[{productId:'one',quantity:1}],discountAmount:'0.00'},restored={items:[{productId:'one',quantity:1}],discountAmount:'0.00',couponCode:'SAVE10'};
 expect(sameGatewayCart(original,restored)).toBe(true);expect(sameGatewayCart(original,{...restored,couponCode:'OTHER'})).toBe(false);expect(sameGatewayCart(original,{...restored,discountAmount:'1.00'})).toBe(false);expect(sameGatewayCart(original,{...restored,items:[{productId:'one',quantity:2}]})).toBe(false);
});

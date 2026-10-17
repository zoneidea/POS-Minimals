import type {CompletedSale} from '../pos/checkout-client';
import {escapeHtml} from '../../lib/escape-html';
export function couponReceiptFooter(receipt:CompletedSale['receipt'],voided:boolean){
 if(voided||!receipt.couponOffers?.length)return '';
 return `<section style="border-top:1px dashed #999;padding-top:2mm"><h2>คูปองส่วนลด</h2>${receipt.couponOffers.map(c=>`<p><strong>${escapeHtml(c.name)}</strong><br>โค้ด ${escapeHtml(c.code)} · ลด ฿${escapeHtml(c.amount)}<br><small>ใช้ถึง ${escapeHtml(c.endsOn)} · ตามจำนวนและเงื่อนไขคูปอง</small></p>`).join('')}</section>`;
}

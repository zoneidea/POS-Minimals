import {escapeHtml} from '../../lib/escape-html';
import {couponReceiptFooter} from '../coupons/receipt-footer';
import {receiptFontCss} from './receipt-font';
import {agentPrint,printerProfile} from '../printing/agent-client';
import type {CompletedSale} from '../pos/checkout-client';
export function receiptHtml(sale:CompletedSale,voided=false,copy=true){
 const receipt=sale.receipt,date=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(receipt.completedAtUtc));
 return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${copy?'สำเนา':'ใบเสร็จ'} ${escapeHtml(receipt.saleNo)}</title><style>${receiptFontCss}
 @page{size:auto;margin:0}
 *{box-sizing:border-box}html{margin:0;padding:0}body{font:12px/1.45 Prompt,Tahoma,sans-serif;color:#000;background:#fff;margin:0;width:var(--receipt-width,80mm);padding:3mm}
 h1,h2{text-align:center;margin:0 0 2mm}h1{font-size:18px}h2{font-size:15px;overflow-wrap:anywhere}
 p{margin:2mm 0;overflow-wrap:anywhere}.receipt-number{display:block;font:11px Prompt,Tahoma,sans-serif;white-space:nowrap;overflow-wrap:normal}
 table{width:100%;table-layout:fixed;border-collapse:collapse}td,th{padding:2mm 0;text-align:left;vertical-align:top;border-bottom:1px dashed #999}
 .item-name{width:55%;overflow-wrap:anywhere;padding-right:1mm}.item-quantity{width:12%;text-align:center}.item-total{width:33%;text-align:right;white-space:nowrap}
 small{font-size:10px}tr{break-inside:avoid}.receipt-totals{margin-top:2mm}.receipt-total-row{display:flex;justify-content:space-between;gap:2mm;margin:1mm 0}.receipt-total-row span:last-child{white-space:nowrap}.receipt-grand-total{font-size:15px;font-weight:700;border-top:1px dashed #999;padding-top:2mm}
 </style></head><body><h1>${copy?'สำเนา':'ใบเสร็จ'}</h1>${voided?'<h2>บิลยกเลิกแล้ว</h2>':''}<h2>${escapeHtml(receipt.store.name)}</h2><p>เลขที่บิล:<strong class="receipt-number" style="font-size:${receipt.saleNo.length>32?8:11}px">${escapeHtml(receipt.saleNo)}</strong>วันที่ขาย: ${escapeHtml(date)}<br>ผู้ขาย: ${escapeHtml(receipt.cashierName)}</p>
 <table><thead><tr><th class="item-name">สินค้า</th><th class="item-quantity">ชิ้น</th><th class="item-total">สุทธิ</th></tr></thead><tbody>${receipt.items.map(item=>`<tr><td class="item-name">${escapeHtml(item.productName)}<br><small>฿${escapeHtml(item.unitPrice)} / ชิ้น</small></td><td class="item-quantity">${item.quantity}</td><td class="item-total">${escapeHtml(item.lineTotal)}</td></tr>`).join('')}</tbody></table>
 <div class="receipt-totals">${[['ยอดรวม',receipt.totals.subtotal],['ส่วนลด',receipt.totals.discount],['VAT',receipt.totals.vat]].map(([label,value])=>`<div class="receipt-total-row"><span>${label}</span><span>฿${escapeHtml(value!)}</span></div>`).join('')}<div class="receipt-total-row receipt-grand-total"><span>ยอดชำระ</span><span>฿${escapeHtml(sale.totalAmount)}</span></div><p>${receipt.paymentMethod==='PROMPTPAY'?'PromptPay (Gateway)':'เงินสด'}</p><div class="receipt-total-row"><span>รับเงิน</span><span>฿${escapeHtml(sale.receivedAmount)}</span></div><p style="text-align:right;font-weight:700">เงินทอน ฿${escapeHtml(sale.changeAmount)}</p></div>${couponReceiptFooter(receipt,voided)}</body></html>`;
}
export async function printReceipt(sale:CompletedSale,voided=false,copy=true){const profile=printerProfile();if(profile){await agentPrint(receiptHtml(sale,voided,copy),profile);return 'submitted' as const;}const frame=document.createElement('iframe');frame.title=copy?'พิมพ์สำเนาใบเสร็จ':'พิมพ์ใบเสร็จ';frame.style.cssText='position:fixed;width:0;height:0;border:0;left:-10000px';frame.onload=async()=>{const target=frame.contentWindow;if(!target){frame.remove();return;}target.addEventListener('afterprint',()=>frame.remove(),{once:true});await frame.contentDocument?.fonts.ready;target.focus();target.print();};frame.srcdoc=receiptHtml(sale,voided,copy);document.body.append(frame);return 'dialog' as const;}

export function receiptCopyHtml(sale:CompletedSale,voided=false){return receiptHtml(sale,voided,true);}
export function printReceiptCopy(sale:CompletedSale,voided=false){return printReceipt(sale,voided,true);}

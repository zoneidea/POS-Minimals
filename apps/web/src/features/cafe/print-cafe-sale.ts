import {cafeItemHtml} from '../cafe-options/item-details-html';
import {escapeHtml} from '../../lib/escape-html';
import {receiptFontCss} from '../sales/receipt-font';
import {printHtml,receiptHtml} from '../sales/print-receipt-copy';
import {agentPrint,printerProfile} from '../printing/agent-client';
import type {CompletedSale} from '../pos/checkout-client';
export function preparationHtml(sale:CompletedSale,copy=false){
 const r=sale.receipt;if(!r.cafe)throw new Error('บิลนี้ไม่มีใบออเดอร์คาเฟ่');
 const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(r.completedAtUtc));
 return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบออเดอร์เตรียม ${escapeHtml(r.saleNo)}</title><style>${receiptFontCss}@page{size:auto;margin:0}*{box-sizing:border-box}body{margin:0;padding:3mm;width:var(--receipt-width,80mm);font:14px/1.5 Prompt,Tahoma,sans-serif;color:#000;background:white}h1,h2,p{margin:0 0 2mm}h1{font-size:20px;text-align:center}h2{text-align:center;font-size:32px}.prep-row{display:flex;gap:3mm;justify-content:space-between;border-top:1px dashed #999;padding:3mm 0;break-inside:avoid}.prep-row strong{overflow-wrap:anywhere}.prep-row span{white-space:nowrap}small{font-size:10px;overflow-wrap:anywhere}</style></head><body><h1>ใบออเดอร์เตรียม${copy?' · พิมพ์ซ้ำ':''}</h1><h2 style="text-align:center;font-size:32px">คิว ${escapeHtml(r.cafe.queueNo)}</h2><p>${escapeHtml(r.store.name)}</p><small>เลขที่บิล: ${escapeHtml(r.saleNo)}<br>${escapeHtml(date)}<br>ผู้รับออเดอร์: ${escapeHtml(r.cashierName)}</small>${r.items.map(i=>`<div class="prep-row" style="display:flex;justify-content:space-between;gap:3mm;border-top:1px dashed #999;padding:3mm 0;break-inside:avoid"><div style="min-width:0"><strong>${escapeHtml(i.productName)}</strong>${cafeItemHtml(i)}</div><span>× ${i.quantity}</span></div>`).join('')}</body></html>`;
}
// Keep each paid cafe pair adjacent to the next pair submitted from this POS tab.
let pending:Promise<unknown>=Promise.resolve();
export function printCafeSale(sale:CompletedSale){
 const run=pending.catch(()=>{}).then(async()=>{const profile=printerProfile(),receipt=receiptHtml(sale,false,false),prep=preparationHtml(sale);
  if(!profile){const body=prep.split('<body>')[1]?.split('</body>')[0]??'';return printHtml(receipt.replace('</body>',`<section style="break-before:page;page-break-before:always">${body}</section></body>`),'ใบเสร็จและใบออเดอร์เตรียม');}
  try{await agentPrint(receipt,profile);}catch(e){throw new Error(`ใบเสร็จยังยืนยันการพิมพ์ไม่ได้ กรุณาตรวจเครื่องก่อนพิมพ์ซ้ำ: ${e instanceof Error?e.message:''}`);}
  try{await agentPrint(prep,profile);}catch(e){throw new Error(`ส่งใบเสร็จแล้ว แต่ใบออเดอร์เตรียมยังยืนยันการพิมพ์ไม่ได้ กรุณาตรวจเครื่องก่อนพิมพ์ใบเตรียมซ้ำ: ${e instanceof Error?e.message:''}`);}
  return 'submitted' as const;
 });pending=run;return run;
}

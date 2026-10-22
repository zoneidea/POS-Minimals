import type {RestaurantBill,RestaurantRound} from '@pos/contracts/restaurant';
import {escapeHtml} from '../../lib/escape-html';
import {receiptFontCss} from '../sales/receipt-font';
import {cafeItemHtml} from '../cafe-options/item-details-html';
import {printHtml} from '../sales/print-receipt-copy';
export function roundHtml(bill:RestaurantBill,round:RestaurantRound,copy=false){
 const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(round.createdAt));
 return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเตรียมอาหาร</title><style>${receiptFontCss}@page{size:auto;margin:0}*{box-sizing:border-box}body{margin:0;padding:3mm;width:var(--receipt-width,80mm);font:14px/1.5 Prompt,Tahoma,sans-serif;color:#000;background:white}h1,h2{text-align:center;margin:0 0 2mm}h1{font-size:20px}h2{font-size:28px}.row{border-top:1px dashed #999;padding:3mm 0;break-inside:avoid;overflow-wrap:anywhere}.count{float:right}small{font-size:10px}</style></head><body><h1>ใบเตรียมอาหาร${copy?' · พิมพ์ซ้ำ':''}</h1><h2>โต๊ะ ${escapeHtml(bill.tableName)}</h2><p>รอบที่ ${round.number} · ${escapeHtml(date)}</p><small>ออเดอร์ ${escapeHtml(round.id)}</small>${round.items.map(i=>`<div class="row"><strong>${escapeHtml(i.name)}</strong><span class="count">× ${i.quantity}</span>${cafeItemHtml(i)}</div>`).join('')}</body></html>`;
}
export function printRound(bill:RestaurantBill,round:RestaurantRound,copy=false){return printHtml(roundHtml(bill,round,copy),'ใบเตรียมอาหาร');}

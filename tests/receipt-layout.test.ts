import {expect,it} from 'vitest';
import {receiptHtml} from '../apps/web/src/features/sales/print-receipt-copy';
import type {CompletedSale} from '../apps/web/src/features/pos/checkout-client';
const sale:CompletedSale={saleId:'id',saleNo:'BFU1XYoAtQXuZ0k2HlmQJhw',status:'COMPLETED',totalAmount:'264.00',receivedAmount:'300.00',changeAmount:'36.00',receipt:{saleId:'id',saleNo:'BFU1XYoAtQXuZ0k2HlmQJhw',completedAtUtc:'2026-10-17T06:46:59Z',store:{name:'ร้านไอเดียคอฟฟี่'},cashierName:'ไอเดียคอฟฟี่',items:Array.from({length:12},(_,index)=>({barcode:String(index),productName:`เลย์ บาร์บีคิว ${index+1}`,quantity:1,unitPrice:'22.00',discountAmount:'0.00',lineTotal:'22.00'})),totals:{subtotal:'264.00',discount:'0.00',vat:'0.00',total:'264.00',received:'300.00',change:'36.00'}}};
it('keeps original receipt identity, final item, totals/change, embedded font and bounded columns',()=>{
 const html=receiptHtml(sale,false,false);
 expect(html).toContain('<h1>ใบเสร็จ</h1>');expect(html).toContain(sale.saleNo);expect(html).toContain('เลย์ บาร์บีคิว 12');expect(html).toContain('เงินทอน ฿36.00');expect(html).toContain('264.00');expect(html).toContain('table-layout:fixed');expect(html).toContain('--receipt-width,80mm');expect(html).toContain('@font-face');expect(html).not.toContain('<script>');
});

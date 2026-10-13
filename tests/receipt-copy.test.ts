import {expect,it} from 'vitest';
import {receiptCopyHtml} from '../apps/web/src/features/sales/print-receipt-copy';
import type {CompletedSale} from '../apps/web/src/features/pos/checkout-client';
it('prints every item, marks copy/void status, keeps receipt identity and escapes customer-facing snapshots',()=>{
 const sale:CompletedSale={saleId:'id',saleNo:'B001',status:'COMPLETED',totalAmount:'12.00',receivedAmount:'20.00',changeAmount:'8.00',receipt:{saleId:'id',saleNo:'B001',completedAtUtc:'2026-10-13T02:00:00Z',store:{name:'<script>alert(1)</script>'},cashierName:'User',items:Array.from({length:12},(_,index)=>({barcode:String(index),productName:`Product ${index}`,quantity:1,unitPrice:'1.00',discountAmount:'0.00',lineTotal:'1.00'})),totals:{subtotal:'12.00',discount:'0.00',vat:'0.00',total:'12.00',received:'20.00',change:'8.00'}}};
 const html=receiptCopyHtml(sale,true);expect(html).toContain('<h1>สำเนา</h1>');expect(html).toContain('บิลยกเลิกแล้ว');expect(html).toContain('Product 11');expect(html).toContain('B001');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('เงินทอน ฿8.00');
});

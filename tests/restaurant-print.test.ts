import {it,expect} from 'vitest';
import {roundHtml} from '../apps/web/src/features/restaurant/print-round';
import {receiptHtml} from '../apps/web/src/features/sales/print-receipt-copy';
import type {RestaurantBill} from '@pos/contracts/restaurant';
import type {CompletedSale} from '../apps/web/src/features/pos/checkout-client';
it('prints only the confirmed round with escaped table/item/notes and no paid-receipt claim',()=>{
 const bill={tableName:'A<script>',rounds:[{id:'order1',number:2,createdAt:'2026-10-23T10:00:00Z',items:[{name:'Tea & Milk',quantity:2,note:'<b>less ice</b>',options:[{name:'Large',groupName:'Size',price:'10.00'}]}]}]} as unknown as RestaurantBill;
 const html=roundHtml(bill,bill.rounds[0]!);expect(html).toContain('A&lt;script&gt;');expect(html).toContain('Tea &amp; Milk');expect(html).toContain('&lt;b&gt;less ice&lt;/b&gt;');expect(html).toContain('Large');expect(html).toContain('× 2');expect(html).not.toContain('ยอดชำระ');expect(html).not.toContain('<script>');
});
it('retains a table label on restaurant receipt without adding a cafe queue',()=>{
 const sale={saleNo:'B1',totalAmount:'50.00',receivedAmount:'100.00',changeAmount:'50.00',receipt:{saleNo:'B1',restaurant:{tableName:'A1'},completedAtUtc:'2026-10-23T10:00:00Z',store:{name:'Restaurant'},cashierName:'Staff',items:[],totals:{subtotal:'50.00',discount:'0.00',vat:'0.00'}}} as unknown as CompletedSale;
 const html=receiptHtml(sale,false,false);expect(html).toContain('โต๊ะ A1');expect(html).toContain('50.00');expect(html).not.toContain('คิว ');
});

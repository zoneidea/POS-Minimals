import {it,expect,vi} from 'vitest';
import {renderToString} from 'react-dom/server';
vi.mock('../apps/web/src/lib/client',()=>({auth:{},request:vi.fn(),RequestError:class extends Error{},authMessage:()=>''}));
import {RestaurantFloorplan} from '../apps/web/src/features/restaurant/RestaurantFloorplan';
import {DiningTable} from '../apps/web/src/features/restaurant/DiningTable';
import {RestaurantCart} from '../apps/web/src/features/restaurant/RestaurantCart';
import {billCartItems} from '../apps/web/src/features/restaurant/bill-cart';
import type {RestaurantBill,RestaurantTable} from '@pos/contracts/restaurant';
const bill={id:'b',tableId:'t',tableName:'A1',status:'OPEN',version:2,openedAt:'2026-10-23T00:00:00Z',totalAmount:'80.00',rounds:[{id:'r',number:1,createdAt:'2026-10-23T00:00:00Z',cancelled:false,cancelReason:null,items:[{productId:'p',lineId:'l',name:'Tea',barcode:'P',quantity:2,unitPrice:'40.00',lineTotal:'80.00',options:[],note:'Less ice'}]},{id:'cancel',number:2,cancelled:true,items:[{productId:'other',lineId:'old',name:'Cancelled',quantity:1,unitPrice:'10.00'}]}]} as unknown as RestaurantBill;
it.each([1,2,4,6,20,100])('renders exactly %i seats around the table, with an accessible occupancy label',seats=>{
 const table={id:'t',name:'A1',zone:'Garden',seats,enabled:true,version:1,bill:null} as RestaurantTable;
 const free=renderToString(<DiningTable table={table} onSelect={()=>{}}/>),busy=renderToString(<DiningTable table={{...table,bill}} onSelect={()=>{}}/>);
 expect(free.match(/data-seat=/g)).toHaveLength(seats);expect(free).toContain('data-open="false"');expect(free).toContain('ว่าง');expect(busy).toContain('data-open="true"');expect(busy).toContain('ไม่ว่าง');expect(busy).toContain('80.00');
});
it('loads all confirmed orders into the cart, excludes cancelled rounds, and blocks checkout with unsent food',()=>{
 const sent=billCartItems(bill);expect(sent).toHaveLength(1);expect(sent[0]).toMatchObject({name:'Tea',quantity:2,salePrice:'40.00',note:'Less ice'});
 const html=renderToString(<RestaurantCart bill={bill} draft={[]} locked={false} busy={false} hasPending={false} onRemove={()=>{}} onSend={()=>{}} onCheckout={()=>{}}/>);expect(html).toContain('Tea');expect(html).toContain('ส่งออเดอร์แล้ว');expect(html).not.toContain('Cancelled');expect(html.match(/<button class="pos-pay"[^>]*>/)?.[0]).not.toContain('disabled');
 const draft=renderToString(<RestaurantCart bill={bill} draft={[{...sent[0]!,lineId:'new'}]} locked={false} busy={false} hasPending={false} onRemove={()=>{}} onSend={()=>{}} onCheckout={()=>{}}/>);expect(draft).toContain('รายการใหม่ · ยังไม่ส่ง');expect(draft).toContain('ส่งรายการใหม่ก่อนเข้าสู่ Checkout');expect(draft.match(/<button class="pos-pay"[^>]*>/)?.[0]).toContain('disabled');
});

it('keeps the selected occupied table in the floorplan with an order/checkout cart',()=>{
 const table={id:'t',name:'A1',zone:'Garden',seats:4,enabled:true,version:1,bill} as RestaurantTable;
 const floor=renderToString(<RestaurantFloorplan tables={[table]} loading={false} disabled={false} canManage selected="t" zone="" onZone={()=>{}} onSelect={()=>{}}/>);
 expect(floor).toContain('data-selected="true"');expect(floor).toContain('data-open="true"');
 const html=renderToString(<RestaurantCart bill={bill} overview draft={[]} locked={false} busy={false} hasPending={false} onRemove={()=>{}} onSend={()=>{}} onCheckout={()=>{}}/>);
 expect(html).toContain('restaurant-overview-actions');expect(html).toContain('สั่งอาหาร');expect(html).toContain('คิดเงิน');expect(html).not.toContain('ส่งออเดอร์ / พิมพ์ใบเตรียม');expect(html.match(/<button[^>]*disabled/g)).toBeNull();
});

import {afterEach,expect,it,vi} from 'vitest';
import {completeCheckout} from '../apps/web/src/features/pos/complete-checkout';
import {printReceipt} from '../apps/web/src/features/sales/print-receipt-copy';
import type {CompletedSale} from '../apps/web/src/features/pos/checkout-client';
vi.mock('../apps/web/src/features/sales/print-receipt-copy',()=>({printReceipt:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
const sale={saleId:'id',saleNo:'B001'} as CompletedSale;
it('releases checkout/cart before the printer responds and prints the original once',async()=>{
 let finish!:(value:'submitted')=>void;const events:string[]=[];
 vi.mocked(printReceipt).mockImplementation(()=>{events.push('print');return new Promise(resolve=>{finish=resolve;});});
 const status=vi.fn();const pending=completeCheckout(sale,true,{close:()=>events.push('close'),clear:()=>events.push('clear'),status});
 expect(events).toEqual(['close','clear','print']);expect(printReceipt).toHaveBeenCalledExactlyOnceWith(sale,false,false);
 finish('submitted');await pending;expect(status).toHaveBeenLastCalledWith(expect.stringContaining('เข้าคิวพิมพ์แล้ว'));
});
it('preserves a different cart when recovering a prior gateway sale; printer failure never retries payment or print',async()=>{
 vi.mocked(printReceipt).mockRejectedValue(new Error('PRINT_FAILED'));const clear=vi.fn(),close=vi.fn(),status=vi.fn();
 await completeCheckout(sale,false,{clear,close,status});expect(clear).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();expect(printReceipt).toHaveBeenCalledOnce();expect(status).toHaveBeenLastCalledWith(expect.stringContaining('บันทึกบิล B001 สำเร็จ แต่พิมพ์ไม่สำเร็จ'),true);
});

import {afterEach,expect,it,vi} from 'vitest';
import {printCafeSale,preparationHtml} from '../apps/web/src/features/cafe/print-cafe-sale';
import {receiptHtml} from '../apps/web/src/features/sales/print-receipt-copy';
import {agentPrint,printerProfile} from '../apps/web/src/features/printing/agent-client';
import type {CompletedSale} from '../apps/web/src/features/pos/checkout-client';
vi.mock('../apps/web/src/features/printing/agent-client',()=>({agentPrint:vi.fn(),printerProfile:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
const sale:CompletedSale={saleId:'id',saleNo:'B001',status:'COMPLETED',totalAmount:'45.00',receivedAmount:'50.00',changeAmount:'5.00',receipt:{cafe:{queueNo:'A007',queueDate:'2026-10-22'},saleId:'id',saleNo:'B001',completedAtUtc:'2026-10-22T03:00:00Z',store:{name:'Cafe'},cashierName:'Owner',items:[{barcode:'1',productName:'Latte <script>',quantity:1,unitPrice:'45.00',discountAmount:'0.00',lineTotal:'45.00'}],totals:{subtotal:'45.00',discount:'0.00',vat:'0.00',total:'45.00',received:'50.00',change:'5.00'}}};
it('prints a receipt then a price-free preparation ticket with identical immutable queue and escaped names',async()=>{
 vi.mocked(printerProfile).mockReturnValue({token:'a'.repeat(64),width:80,printer:'Thermal'});vi.mocked(agentPrint).mockResolvedValue({submitted:true});
 await printCafeSale(sale);const calls=vi.mocked(agentPrint).mock.calls;expect(calls).toHaveLength(2);expect(calls[0]![0]).toContain('<h1>ใบเสร็จ</h1>');expect(calls[1]![0]).toContain('ใบออเดอร์เตรียม');
 for(const [html,profile] of calls){expect(html).toContain('A007');expect(html).toContain('B001');expect(html).toContain('Latte &lt;script&gt;');expect(html).not.toContain('<script>');expect(profile.printer).toBe('Thermal');}
 expect(calls[1]![0]).not.toContain('45.00');expect(calls[1]![0]).not.toContain('เงินทอน');expect(preparationHtml(sale,true)).toContain('พิมพ์ซ้ำ');expect(receiptHtml(sale,false,true)).toContain('สำเนา');
});
it('serializes pairs from rapid consecutive sales and never retries an uncertain preparation job',async()=>{
 vi.mocked(printerProfile).mockReturnValue({token:'a'.repeat(64),width:80,printer:''});let finish!:()=>void;const gate=new Promise<{submitted:true}>(resolve=>{finish=()=>resolve({submitted:true});});vi.mocked(agentPrint).mockReturnValueOnce(gate).mockResolvedValue({submitted:true});
 const first=printCafeSale(sale),second=printCafeSale({...sale,saleNo:'B002',receipt:{...sale.receipt,saleNo:'B002'}});await Promise.resolve();await Promise.resolve();expect(agentPrint).toHaveBeenCalledOnce();finish();await Promise.all([first,second]);expect(vi.mocked(agentPrint).mock.calls.map(c=>c[0].includes('B002'))).toEqual([false,false,true,true]);
 vi.mocked(agentPrint).mockClear().mockResolvedValueOnce({submitted:true}).mockRejectedValueOnce(new Error('TIMEOUT'));await expect(printCafeSale(sale)).rejects.toThrow('ส่งใบเสร็จแล้ว');expect(agentPrint).toHaveBeenCalledTimes(2);
 vi.mocked(agentPrint).mockClear().mockRejectedValueOnce(new Error('OFFLINE'));await expect(printCafeSale(sale)).rejects.toThrow('ใบเสร็จยังยืนยัน');expect(agentPrint).toHaveBeenCalledOnce();
});

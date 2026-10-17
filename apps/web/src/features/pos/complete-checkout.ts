import type {CompletedSale} from './checkout-client';
import {printReceipt} from '../sales/print-receipt-copy';
// A committed sale stays completed even when the printer is unavailable.
// Release the checkout/cart before waiting for the local print queue.
export async function completeCheckout(sale:CompletedSale,sameCart:boolean,actions:{close:()=>void;clear:()=>void;status:(message:string,failed?:boolean)=>void}) {
 actions.close();
 if(sameCart)actions.clear();
 actions.status(`บันทึกบิล ${sale.saleNo} แล้ว · กำลังส่งพิมพ์ใบเสร็จ`);
 try {
  const result=await printReceipt(sale,false,false);
  actions.status(result==='submitted'?`บิล ${sale.saleNo} · ส่งใบเสร็จเข้าคิวพิมพ์แล้ว`:`บิล ${sale.saleNo} · เปิดหน้าพิมพ์ใบเสร็จแล้ว`);
 } catch(error) {
  actions.status(`บันทึกบิล ${sale.saleNo} สำเร็จ แต่พิมพ์ไม่สำเร็จ: ${error instanceof Error?error.message:'ตรวจสอบเครื่องพิมพ์'} · พิมพ์สำเนาได้จากเมนูรายการขาย`,true);
 }
}

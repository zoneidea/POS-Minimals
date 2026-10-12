import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import type { CompletedSale } from './checkout-client';
export function SaleReceipt({sale,onClose}:{sale:CompletedSale;onClose:()=>void}){
 const [page,setPage]=useState(1),receipt=sale.receipt;
 return <div className="sale-receipt"><h3><CheckCircle2 size={22}/>บันทึกขายสำเร็จ</h3><p><strong>{receipt.store.name}</strong><br/>{sale.saleNo}<br/>{new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(receipt.completedAtUtc))} · {receipt.cashierName}</p>
 <DataTable label="รายการในบิล" rows={receipt.items.slice((page-1)*10,page*10)} rowKey={row=>row.barcode} total={receipt.items.length} page={page} onPageChange={setPage} columns={[{key:'name',header:'สินค้า',render:row=>row.productName},{key:'quantity',header:'จำนวน',render:row=>row.quantity},{key:'price',header:'ราคา',render:row=>row.unitPrice},{key:'total',header:'สุทธิ',render:row=>row.lineTotal}]}/>
 <p>ยอดรวม ฿{receipt.totals.subtotal} · ส่วนลด ฿{receipt.totals.discount} · VAT ฿{receipt.totals.vat}</p><p><strong>ยอดชำระ ฿{sale.totalAmount} · รับเงิน ฿{sale.receivedAmount} · เงินทอน ฿{sale.changeAmount}</strong></p><button className="primary" onClick={onClose}>ขายรายการถัดไป</button></div>;
}

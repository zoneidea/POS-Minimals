import { ReceiptDetails } from '../sales/ReceiptDetails';
import { CheckCircle2 } from 'lucide-react';
import type { CompletedSale } from './checkout-client';
export function SaleReceipt({sale,onClose}:{sale:CompletedSale;onClose:()=>void}){return <div className="sale-receipt"><h3><CheckCircle2 size={22}/>บันทึกขายสำเร็จ</h3><ReceiptDetails sale={sale}/><button className="primary" onClick={onClose}>ขายรายการถัดไป</button></div>;}

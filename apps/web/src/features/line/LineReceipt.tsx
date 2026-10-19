import {CheckCircle2} from 'lucide-react';
import {ReceiptDetails} from '../sales/ReceiptDetails';
import type {LineSale} from './schema';
export function LineReceipt({sale,onClose,copy=false,voided=false}:{sale:LineSale;onClose:()=>void;copy?:boolean;voided?:boolean}){return <section className="line-receipt"><div className="line-success"><CheckCircle2 size={44}/><h1>{copy?'รายละเอียดบิล':'บันทึกการขายสำเร็จ'}</h1><p>ใบเสร็จดิจิทัล{voided?' · ยกเลิกแล้ว':''}</p></div><ReceiptDetails sale={sale}/><button className="line-primary" onClick={onClose}>{copy?'กลับไปรายการขาย':'ขายรายการใหม่'}</button></section>;}

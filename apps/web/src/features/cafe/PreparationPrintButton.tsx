import {useState} from 'react';
import {Printer} from 'lucide-react';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {printHtml} from '../sales/print-receipt-copy';
import {preparationHtml} from './print-cafe-sale';
import type {CompletedSale} from '../pos/checkout-client';
export function PreparationPrintButton({sale}:{sale:CompletedSale}){const [busy,setBusy]=useState(false);if(!sale.receipt.cafe)return null;return <button type="button" className="secondary" disabled={busy} onClick={async()=>{if(!await confirmAlert('พิมพ์ใบออเดอร์เตรียมซ้ำหรือไม่? กรุณาตรวจสอบว่าไม่ได้เตรียมสินค้าซ้ำ'))return;setBusy(true);try{await printHtml(preparationHtml(sale,true),'พิมพ์ใบออเดอร์เตรียมซ้ำ');await successAlert('ส่งพิมพ์ใบออเดอร์เตรียมแล้ว');}catch(e){await warningAlert(e instanceof Error?e.message:'พิมพ์ไม่สำเร็จ');}finally{setBusy(false);}}}><Printer size={18}/>{busy?'กำลังส่งพิมพ์':'พิมพ์ใบออเดอร์เตรียมซ้ำ'}</button>;}

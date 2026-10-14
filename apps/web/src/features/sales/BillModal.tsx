import './sales.css';
import {Printer} from 'lucide-react';
import {ReceiptPrintButton} from '../printing/ReceiptPrintButton';
import { useEffect,useState } from 'react';
import { Modal } from '../../components/Modal';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { getBill,type Bill } from './client';
import { ReceiptDetails } from './ReceiptDetails';
export function BillModal({id,onClose}:{id:string;onClose:()=>void}){const [bill,setBill]=useState<Bill|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setBill(null);setError('');getBill(id,controller.signal).then(value=>{if(!controller.signal.aborted)setBill(value);}).catch(e=>{if(!controller.signal.aborted)setError(authMessage(e));});return()=>controller.abort();},[id,revision]);
 return <Modal title="ดูบิล / ใบเสร็จ" onClose={onClose}>{error?<><Notice>{error}</Notice><button className="secondary" onClick={()=>setRevision(v=>v+1)}>ลองใหม่</button></>:bill?<><p>{bill.status==='VOIDED'?`บิลยกเลิกแล้ว · ${bill.voidReason??''}`:'บิลสำเร็จ'}</p><ReceiptDetails sale={bill.sale}/><ReceiptPrintButton sale={bill.sale} copy voided={bill.status==='VOIDED'}/></>:<p role="status"><Busy/>กำลังโหลดบิล</p>}</Modal>;
}

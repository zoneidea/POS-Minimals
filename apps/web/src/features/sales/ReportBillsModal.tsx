import { ReceiptText } from 'lucide-react';
import { useEffect,useState } from 'react';
import { Modal } from '../../components/Modal';
import { DataTable } from '../../components/DataTable';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import type { ReportQuery } from '../reports/schema';
import { listReportBills,type SaleSummary } from './client';
import { BillModal } from './BillModal';
export function ReportBillsModal({query,period,onClose}:{query:ReportQuery;period:string;onClose:()=>void}){const [rows,setRows]=useState<SaleSummary[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(true),[selected,setSelected]=useState<string|null>(null),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');listReportBills({...query,page},period,controller.signal).then(data=>{if(!controller.signal.aborted){setRows(data.items);setTotal(data.total);}}).catch(e=>{if(!controller.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[query,period,page,revision]);
 return <Modal title={`บิลในช่วง ${period}`} onClose={onClose}>{busy?<p role="status"><Busy/>กำลังโหลดบิล</p>:null}{error?<><Notice>{error}</Notice><button className="secondary" onClick={()=>setRevision(v=>v+1)}>ลองใหม่</button></>:<DataTable label="บิลในรายงานยอดขาย" rows={rows} total={total} page={page} onPageChange={setPage} disabled={busy} rowKey={r=>r.id} columns={[{key:'number',header:'เลขที่บิล',render:r=>r.saleNo},{key:'cashier',header:'ผู้ขาย',render:r=>r.cashierName},{key:'quantity',header:'จำนวนชิ้น',render:r=>r.itemCount},{key:'payment',header:'ช่องทางชำระ',render:r=>r.paymentMethod==='CASH'?'เงินสด':'PromptPay'},{key:'received',header:'รับเงิน',render:r=>r.receivedAmount},{key:'total',header:'ยอดสุทธิ',render:r=>r.totalAmount},{key:'status',header:'สถานะ',render:r=>r.status==='VOIDED'?'ยกเลิกแล้ว':'สำเร็จ'},{key:'view',header:'บิล',render:r=><button className="secondary" disabled={busy} onClick={()=>setSelected(r.id)}><ReceiptText size={16}/>ดูบิล</button>}]}/>} {selected?<BillModal id={selected} onClose={()=>setSelected(null)}/>:null}</Modal>;
}

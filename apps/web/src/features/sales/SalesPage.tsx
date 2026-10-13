import { BillModal } from './BillModal';
import { useEffect,useState } from 'react';
import { RefreshCw,Undo2,ReceiptText } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { listSales,type SaleSummary } from './client';
import { VoidSaleModal } from './VoidSaleModal';
export function SalesPage(){
 const [billId,setBillId]=useState<string|null>(null);
 const [items,setItems]=useState<SaleSummary[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<SaleSummary|null>(null);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');listSales(page,controller.signal).then(result=>{if(!controller.signal.aborted){setItems(result.items);setTotal(result.total);}}).catch(error=>{if(!controller.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[page,revision]);
 return <><div className="category-actions"><button className="secondary" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={18}/>โหลดใหม่</button></div>{loading?<p role="status"><Busy/>กำลังโหลดรายการขาย</p>:null}{error?<Notice>{error}</Notice>:null}{<DataTable error={Boolean(error)} loading={loading} emptyMessage="ไม่มีข้อมูลรายการขาย" label="รายการขาย" rows={items} total={total} page={page} onPageChange={setPage} disabled={loading} rowKey={sale=>sale.id} columns={[
 {key:'number',header:'เลขที่บิล',render:sale=>sale.saleNo},
 {key:'time',header:'เวลาขาย',render:sale=>new Date(sale.completedAtUtc).toLocaleString('th-TH')},
 {key:'cashier',header:'ผู้ขาย',render:sale=>sale.cashierName},
 {key:'quantity',header:'จำนวนชิ้น',render:sale=>sale.itemCount},
 {key:'payment',header:'ช่องทางชำระเงิน',render:sale=>sale.paymentMethod==='CASH'?'เงินสด':'PromptPay'},
 {key:'received',header:'รับเงิน (บาท)',render:sale=>sale.receivedAmount},
 {key:'total',header:'ยอด (บาท)',render:sale=>sale.totalAmount},
 {key:'status',header:'สถานะ',render:sale=>sale.status==='VOIDED'?<span title={sale.voidReason??''}>ยกเลิกแล้ว</span>:'สำเร็จ'},
 {key:'action',header:'ยกเลิก',render:sale=>sale.status==='COMPLETED'?<div><button className="secondary" disabled={loading||Date.now()>Date.parse(sale.voidDeadlineUtc)} onClick={()=>setSelected(sale)}><Undo2 size={16}/>ยกเลิกการขาย</button><small style={{display:'block'}}>ภายใน {new Date(sale.voidDeadlineUtc).toLocaleString('th-TH')}</small></div>:<span>{sale.voidedAtUtc?new Date(sale.voidedAtUtc).toLocaleString('th-TH'):''}</span>},
 {key:'bill',header:'บิล',render:sale=><button className="secondary" disabled={loading} onClick={()=>setBillId(sale.id)}><ReceiptText size={16}/>ดูบิล</button>}
 ]}/>}{billId?<BillModal id={billId} onClose={()=>setBillId(null)}/>:null}{selected?<VoidSaleModal sale={selected} onClose={()=>{setSelected(null);setRevision(value=>value+1);}} onSaved={()=>{setSelected(null);setRevision(value=>value+1);}}/>:null}</>;
}

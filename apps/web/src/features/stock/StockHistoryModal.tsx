import { useEffect,useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { DataTable } from '../../components/DataTable';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { stockHistory,type StockMovement } from './client';
const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'});
export function StockHistoryModal({productId,onClose}:{productId?:string;onClose:()=>void}){
 const [items,setItems]=useState<StockMovement[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');stockHistory(page,productId,controller.signal).then(data=>{if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}}).catch(error=>{if(!controller.signal.aborted)setError(authMessage(error));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[page,productId,revision]);
 return <Modal title="ประวัติการปรับสต็อก" onClose={onClose}><div className="stock-history"><p className="product-note">วันเวลาแสดงตามประเทศไทย · ประวัติยังคงอยู่แม้สินค้าถูกลบ</p>{loading?<div className="loading" role="status"><Busy/>กำลังโหลดประวัติ</div>:error?<><Notice>{error}</Notice><button className="secondary" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/>ลองโหลดใหม่</button></>:<DataTable label="ประวัติสต็อก" rows={items} rowKey={item=>item.id} total={total} page={page} onPageChange={setPage} columns={[
 {key:'time',header:'วันเวลาอัปเดต',render:item=>date.format(new Date(item.updatedAt))},
 {key:'product',header:'สินค้า',render:item=><div><strong>{item.productName}</strong><div className="product-note">{item.barcode}</div></div>},
 {key:'before',header:'ก่อนปรับ',render:item=>item.before},
 {key:'delta',header:'เปลี่ยนแปลง',render:item=><span className={item.delta>0?'stock-normal':'stock-empty'}>{item.delta>0?'+':''}{item.delta}</span>},
 {key:'after',header:'หลังปรับ',render:item=>item.after},
 {key:'actor',header:'ผู้ปรับ',render:item=><div>{item.actorUsername??'บัญชีผู้ใช้'}<div className="actor-id">{item.actorUserId}</div></div>},
 {key:'reason',header:'เหตุผล',render:item=>item.reason}
 ]}/>}</div></Modal>;
}

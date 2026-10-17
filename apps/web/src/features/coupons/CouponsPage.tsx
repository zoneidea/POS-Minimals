import {useEffect,useState} from 'react';
import {Plus,Pencil,Trash2} from 'lucide-react';
import {DataTable} from '../../components/DataTable';
import {Notice,Busy} from '../../components/Notice';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {authMessage} from '../../lib/client';
import {getCoupons,deleteCoupon} from './client';
import {CouponForm,type Coupon} from './CouponForm';
export function CouponsPage(){
 const [data,setData]=useState<{items:Coupon[];total:number}>({items:[],total:0}),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState<Coupon|true|null>(null);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');getCoupons(page,c.signal).then(v=>{if(!c.signal.aborted)setData(v);}).catch(()=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[page,revision]);
 const remove=async(item:Coupon)=>{if(busy)return;setBusy(true);try{if(!await confirmAlert(`ลบคูปอง ${item.code} หรือไม่?`,true))return;await deleteCoupon(item.id,item.version);await successAlert('ลบคูปองสำเร็จ');if(data.items.length===1&&page>1)setPage(v=>v-1);else setRevision(v=>v+1);}catch(e){await warningAlert(authMessage(e));}finally{setBusy(false);}};
 return <section className="category-page"><div className="category-toolbar"><button className="primary" disabled={loading||busy} onClick={()=>setEditing(true)}><Plus size={18}/>เพิ่มคูปอง</button></div><p className="report-note">ใช้ได้ 1 โค้ดต่อบิล · มูลค่าส่วนลดเป็นเงินบาท · จำนวนจะถูกหักเมื่อบันทึกขายสำเร็จ</p>{error?<Notice>{error}</Notice>:null}{loading?<p role="status"><Busy/>กำลังโหลดคูปอง</p>:null}<DataTable<Coupon> label="คูปอง/ส่วนลด" rows={data.items} total={data.total} page={page} onPageChange={setPage} rowKey={v=>v.id} error={Boolean(error)} loading={loading} disabled={busy||Boolean(editing)} columns={[
 {key:'name',header:'ชื่อ / โค้ด',render:v=><><strong>{v.name}</strong><br/><code>{v.code}</code></>},
 {key:'amount',header:'ส่วนลด',render:v=>`฿${v.amount}`},{key:'dates',header:'ช่วงใช้งาน',render:v=>`${v.startsOn} – ${v.endsOn}`},
 {key:'uses',header:'คงเหลือ / ทั้งหมด',render:v=>`${v.maxUses-v.usedCount} / ${v.maxUses}`},{key:'receipt',header:'ท้ายใบเสร็จ',render:v=>v.showOnReceipt?'แสดง':'ไม่แสดง'},
 {key:'actions',header:'จัดการ',render:v=><div className="coupon-actions"><button className="secondary" aria-label={`แก้ไข ${v.code}`} disabled={busy} onClick={()=>setEditing(v)}><Pencil size={16}/></button><button className="secondary danger" aria-label={`ลบ ${v.code}`} disabled={busy} onClick={()=>void remove(v)}><Trash2 size={16}/></button></div>}
 ]}/>{editing?<CouponForm item={editing===true?undefined:editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setRevision(v=>v+1);}}/>:null}</section>;
}

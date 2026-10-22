import {useEffect,useState} from 'react';import {Coffee,Trash2,Eye,Download} from 'lucide-react';import type {CafeStarterStatus} from '@pos/contracts/cafe-options';
import {Busy,Notice} from '../../components/Notice';import {authMessage} from '../../lib/client';import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {readCafeStarter,changeCafeStarter} from './client';import {CafeStarterPreview} from './CafeStarterPreview';import './cafe-starter.css';
export function CafeStarterPanel({disabled=false,onChanged,onContinue}:{disabled?:boolean;onChanged?:()=>void;onContinue?:()=>void}){
 const [data,setData]=useState<CafeStarterStatus|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{const c=new AbortController();readCafeStarter(c.signal).then(v=>{if(!c.signal.aborted)setData(v);}).catch(e=>{if(!c.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
 const run=async(action:'APPLY'|'SKIP'|'CLEAR')=>{
  if(busy||!data)return;
  const clearing=action==='CLEAR';
  if(action!=='SKIP'&&!await confirmAlert(clearing?`ตรวจพบข้อมูลจากชุดตั้งต้น ${data.remaining} รายการ (รวมเมนู หมวดหมู่ และกลุ่มตัวเลือก) ล้างเฉพาะส่วนที่ยังไม่ปรับแต่งหรือไม่? เมนูที่ร้านแก้ไข ข้อมูลที่สร้างเอง หมวดหมู่/ตัวเลือกที่ยังใช้อยู่ และประวัติขายจะถูกเก็บไว้`:`นำเข้า ${data.catalog.products.length} เมนู พร้อมหมวดหมู่และตัวเลือกหรือไม่? ราคาแก้ไขได้ ต้นทุนเริ่มต้นเป็น 0 บาท ระบบจะข้ามเมนูชื่อเดียวกับที่ร้านมีอยู่`,clearing))return;
  setBusy(true);setError('');
  try{
   const result=await changeCafeStarter(action);setData(await readCafeStarter());onChanged?.();
   if(clearing)await successAlert(`ล้างเมนูตั้งต้น ${result.removed??0} รายการ · เก็บเมนูที่ปรับแต่ง/มีสต็อก ${result.kept??0} รายการ`);
   else if(action==='APPLY')await successAlert(`เพิ่มเมนู ${result.created??0} รายการ · ข้ามเมนูชื่อซ้ำ ${result.skipped??0} รายการ`);
   else await successAlert('เริ่มต้นด้วยร้านว่างแล้ว');
   if(!clearing)onContinue?.();
  }catch(e){const message=authMessage(e);setError(message);await warningAlert(message);try{setData(await readCafeStarter());onChanged?.();}catch{/* Preserve the original mutation error; server operations are idempotent. */}}
  finally{setBusy(false);}
 };
 const blocked=disabled||busy||loading;
 return <section className="cafe-starter-panel" aria-labelledby="cafe-starter-title"><h2 id="cafe-starter-title"><Coffee size={22} aria-hidden="true"/>ข้อมูลตั้งต้นคาเฟ่</h2>
  {loading?<p role="status"><Busy/>กำลังตรวจสอบชุดข้อมูลตั้งต้น</p>:null}{error?<Notice>{error}</Notice>:null}
  {data?.status==='AVAILABLE'?<><p>เริ่มต้นด้วยเมนูคาเฟ่ของระบบหรือไม่?</p><p className="hint">{data.catalog.categories.length} หมวดหมู่ · {data.catalog.products.length} เมนู · {data.catalog.groups.length} กลุ่มตัวเลือก · ไม่มีรูปสินค้า แก้ไขหรือล้างข้อมูลตั้งต้นภายหลังได้</p><p className="hint">ราคาเป็นค่าเริ่มต้น ไม่ใช่ราคากลางตลาด · ต้นทุนเริ่มต้น 0 บาท กรุณาตรวจสอบก่อนขายและใช้รายงานกำไร</p><div className="cafe-starter-actions"><button type="button" className="secondary" disabled={blocked} onClick={()=>setPreview(true)}><Eye size={18}/>ดูข้อมูลตั้งต้น</button><button type="button" className="primary" disabled={blocked} onClick={()=>void run('APPLY')}>{busy?<Busy/>:<Download size={18}/>}ใช้ข้อมูลตั้งต้น</button>{onContinue?<button type="button" className="secondary" disabled={blocked} onClick={()=>void run('SKIP')}>เริ่มด้วยร้านว่าง</button>:null}</div></>:null}
  {data?.status==='APPLIED'?<><p className="hint">นำเข้าชุดข้อมูลตั้งต้นแล้ว · แก้ไขชื่อ ราคา ต้นทุน และตัวเลือกได้ในหน้าสินค้า</p><div className="cafe-starter-actions"><button type="button" className="secondary danger" disabled={blocked||data.remaining===0} onClick={()=>void run('CLEAR')}><Trash2 size={18}/>ล้างข้อมูลตั้งต้นของระบบ</button></div></>:null}
  {data?.status==='CLEARED'?<p className="hint">ล้างชุดข้อมูลตั้งต้นแล้ว ข้อมูลที่ร้านปรับแต่งหรือยังใช้งานและประวัติขายยังอยู่ ระบบจะไม่นำเข้าซ้ำอัตโนมัติ</p>:null}
  {data?.status==='SKIPPED'?<p className="hint">ร้านนี้เลือกเริ่มต้นด้วยร้านว่าง สามารถเพิ่มสินค้าและตัวเลือกของร้านได้เอง</p>:null}
  {onContinue&&(data?.status!=='AVAILABLE'||error)?<div className="cafe-starter-actions"><button type="button" className="primary" disabled={busy||loading} onClick={onContinue}>เข้าสู่ร้าน</button></div>:null}
  {preview&&data?<CafeStarterPreview catalog={data.catalog} onClose={()=>setPreview(false)}/>:null}
 </section>;
}

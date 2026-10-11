import { useEffect,useState } from 'react';
import { Barcode,Package,Banknote,Save,RefreshCw } from 'lucide-react';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { listCategories,type Category } from '../categories/client';
import { saveProduct,type Product } from './client';
export function ProductForm({item,onSaved,onCancel}:{item?:Product;onSaved:()=>void;onCancel:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[categories,setCategories]=useState<Category[]>([]),[loading,setLoading]=useState(true),[categoryError,setCategoryError]=useState(''),[revision,setRevision]=useState(0),[categoryId,setCategoryId]=useState(item?.categoryId??'');
 useEffect(()=>{const controller=new AbortController();setLoading(true);setCategoryError('');(async()=>{const choices:Category[]=[];let page=1;while(true){const data=await listCategories(page,controller.signal);choices.push(...data.items);if(page*data.limit>=data.total)break;page++;}if(!controller.signal.aborted)setCategories(choices);})().catch(error=>{if(!controller.signal.aborted)setCategoryError(authMessage(error));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
 return <Modal title={item?'แก้ไขสินค้า':'เพิ่มสินค้า'} busy={busy} onClose={onCancel}><form className="product-form" onSubmit={async event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);const input={barcode:String(form.get('barcode')).trim(),name:String(form.get('name')).trim(),categoryId:String(form.get('categoryId'))||null,salePrice:String(form.get('salePrice')).trim(),unitCost:String(form.get('unitCost')).trim()};
  if(!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(input.salePrice)||!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(input.unitCost)){setError('ราคาต้องเป็นตัวเลขตั้งแต่ 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');return;}
  setBusy(true);setError('');try{await saveProduct(input,item);onSaved();}catch(error){setError(authMessage(error));}finally{setBusy(false);}
 }}>
 <Field id="product-barcode" name="barcode" label="บาร์โค้ด" icon={Barcode} defaultValue={item?.barcode??''} maxLength={100} required autoFocus disabled={busy}/>
 <Field id="product-name" name="name" label="ชื่อสินค้า" icon={Package} defaultValue={item?.name??''} maxLength={200} required disabled={busy}/>
 <label className="field" htmlFor="product-category"><span>หมวดหมู่</span><select id="product-category" name="categoryId" value={categoryId} onChange={event=>setCategoryId(event.target.value)} disabled={busy||loading||Boolean(categoryError)}><option value="">ไม่ระบุหมวดหมู่</option>{item?.categoryId&&!categories.some(category=>category.id===item.categoryId)?<option value={item.categoryId}>หมวดหมู่เดิม (กำลังตรวจสอบ)</option>:null}{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
 {loading?<div role="status"><Busy/>กำลังโหลดหมวดหมู่</div>:categoryError?<><Notice>{categoryError}</Notice><button type="button" className="secondary" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/>ลองโหลดหมวดหมู่ใหม่</button></>:null}
 <div className="product-prices"><Field id="product-cost" name="unitCost" label="ต้นทุน (บาท)" icon={Banknote} inputMode="decimal" defaultValue={item?.unitCost??'0'} required disabled={busy}/><Field id="product-price" name="salePrice" label="ราคาขาย (บาท)" icon={Banknote} inputMode="decimal" defaultValue={item?.salePrice??'0'} required disabled={busy}/></div>
 {!item?<p className="product-note">สินค้าใหม่เริ่มต้นที่สต็อก 0 การปรับสต็อกจะเพิ่มในงานถัดไป</p>:null}
 {error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>ยกเลิก</button><button className="primary" disabled={busy||loading||Boolean(categoryError)}>{busy?<Busy/>:<Save size={18} aria-hidden="true"/>}บันทึกสินค้า</button></div>
 </form></Modal>;
}

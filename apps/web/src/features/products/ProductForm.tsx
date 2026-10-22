import './product-form.css';
import type {CafeGroup} from '@pos/contracts/cafe-options';
import {CafeProductGroups} from '../cafe-options/CafeProductGroups';
import {ProductMediaFields} from './ProductMediaFields';
import {ProductAdditionalFields} from './ProductAdditionalFields';
import {confirmAlert,successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useEffect,useState } from 'react';
import { Package,Banknote,Save,RefreshCw } from 'lucide-react';
import { Field } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { listCategories,type Category } from '../categories/client';
import { saveProduct,uploadProductImage,type Product } from './client';
export function ProductForm({item,onSaved,onCancel,cafeGroups}:{cafeGroups?:CafeGroup[];item?:Product;onSaved:()=>void;onCancel:()=>void}){
 const cafe=cafeGroups!==undefined;
 const [trackStock,setTrackStock]=useState(item?.trackStock!==false);
 const [barcode]=useState(()=>item?.barcode??(cafe?'CF-'+crypto.randomUUID().replaceAll('-','').toUpperCase():''));
 const [groupIds,setGroupIds]=useState(()=>cafeGroups?.filter(g=>item&&g.productIds.includes(item.id)).map(g=>g.id)??[]);
 const [image,setImage]=useState<File|null>(null),[saved,setSaved]=useState<Product|undefined>(item);
 const [busy,setBusy]=useState(false),[error,setError]=useActionError(),[categories,setCategories]=useState<Category[]>([]),[loading,setLoading]=useState(true),[categoryError,setCategoryError]=useState(''),[revision,setRevision]=useState(0),[categoryId,setCategoryId]=useState(item?.categoryId??'');
 useEffect(()=>{const controller=new AbortController();setLoading(true);setCategoryError('');(async()=>{const choices:Category[]=[];let page=1;while(true){const data=await listCategories(page,controller.signal);choices.push(...data.items);if(page*data.limit>=data.total)break;page++;}if(!controller.signal.aborted)setCategories(choices);})().catch(error=>{if(!controller.signal.aborted)setCategoryError(authMessage(error));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
 return <Modal title={item?'แก้ไขสินค้า':'เพิ่มสินค้า'} busy={busy} onClose={()=>saved&&saved!==item?onSaved():onCancel()}><form className="product-form" onSubmit={async event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);const initialQuantity=cafe&&!trackStock?0:Number(form.get('initialQuantity'));const input={barcode:String(form.get('barcode')).trim(),name:String(form.get('name')).trim(),categoryId:String(form.get('categoryId'))||null,salePrice:String(form.get('salePrice')).trim(),unitCost:String(form.get('unitCost')).trim(),...(!saved?{initialQuantity}:{}),...(cafe?{cafeOptions:{trackStock,groupIds,versions:cafeGroups.map(g=>({id:g.id,version:g.version}))}}:{})};
  if(!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(input.salePrice)||!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(input.unitCost)){setError('ราคาต้องเป็นตัวเลขตั้งแต่ 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');return;}
  if(!saved&&(!Number.isInteger(initialQuantity)||initialQuantity<0||initialQuantity>2147483647)){setError('จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 2147483647');return;}
  if(saved&&!await confirmAlert())return;
  setBusy(true);setError('');try{const product=await saveProduct(input,saved);setSaved(product);if(image){const updated=await uploadProductImage(product,image);setSaved(updated);}await successAlert();onSaved();}catch(error){setError(image?'ข้อมูลสินค้าอาจบันทึกแล้ว แต่รูปยังไม่สำเร็จ: '+authMessage(error):authMessage(error));}finally{setBusy(false);}
 }}>
 {cafe?<><Field id="product-name" name="name" label="ชื่อสินค้า" icon={Package} defaultValue={item?.name??''} maxLength={200} required autoFocus disabled={busy}/><ProductMediaFields item={item} busy={busy} categories={categories} categoryId={categoryId} onCategory={setCategoryId} loading={loading} error={categoryError} image={image} onImage={setImage}/><CafeProductGroups groups={cafeGroups} selected={groupIds} onChange={setGroupIds} disabled={busy}/><Field id="product-price" name="salePrice" label="ราคา (บาท)" icon={Banknote} inputMode="decimal" defaultValue={item?.salePrice??'0'} required disabled={busy}/><section className="product-stock-policy"><label><input type="checkbox" checked={trackStock} disabled={busy} onChange={e=>setTrackStock(e.target.checked)}/>ติดตามสต็อกสินค้า</label><p className="product-note">{trackStock?'ตรวจจำนวนคงเหลือและตัดสต็อกเมื่อขาย':'ขายได้โดยไม่กำหนดจำนวนคงเหลือ และไม่ตัดสต็อก'}</p>{!item&&trackStock?<Field id="product-quantity" name="initialQuantity" label="จำนวนสินค้าเริ่มต้น" icon={Package} type="number" min={0} max={2147483647} step="1" defaultValue="0" required disabled={busy||Boolean(saved)}/>:null}</section></>:null}
 <ProductAdditionalFields item={item} cafe={cafe} barcode={barcode} busy={busy} saved={Boolean(saved)} categories={categories} categoryId={categoryId} onCategory={setCategoryId} loading={loading} error={categoryError} onRetry={()=>setRevision(v=>v+1)} image={image} onImage={setImage}/>
 {cafe&&loading?<p role="status"><Busy/>กำลังโหลดหมวดหมู่</p>:null}{cafe&&categoryError?<><Notice>{categoryError}</Notice><button type="button" className="secondary" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/>ตรวจสอบหมวดหมู่อีกครั้ง</button></>:null}
 {error?<Notice>{error}</Notice>:null}<div className="category-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>saved&&saved!==item?onSaved():onCancel()}>ยกเลิก</button><button className="primary" disabled={busy||loading||Boolean(categoryError)}>{busy?<Busy/>:<Save size={18} aria-hidden="true"/>}บันทึกสินค้า</button></div>
 </form></Modal>;
}

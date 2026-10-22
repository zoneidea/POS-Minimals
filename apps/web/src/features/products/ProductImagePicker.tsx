import { useEffect,useState } from 'react';
import { ImagePlus,X } from 'lucide-react';
import { Notice } from '../../components/Notice';
export function ProductImagePicker({file,onChange,currentUrl,disabled}:{file:File|null;onChange:(file:File|null)=>void;currentUrl?:string|null;disabled:boolean}){
 const [preview,setPreview]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 return <section className="product-image-picker"><span className="product-image-label">รูปสินค้า <small>(ไม่บังคับ)</small></span><label className="product-image-upload" htmlFor="product-image">{preview||currentUrl?<img className="product-image-preview" src={preview||currentUrl!} alt="ตัวอย่างรูปสินค้า"/>:<span className="product-image-placeholder"><ImagePlus size={28} aria-hidden="true"/></span>}<span className="product-image-caption"><strong>{file?file.name:currentUrl?'เปลี่ยนรูปสินค้า':'เลือกรูปสินค้า'}</strong><small>JPG, PNG หรือ WebP · ไม่เกิน 5MB</small><span className="product-image-choose">เลือกไฟล์</span></span><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event=>{const selected=event.target.files?.[0];setError('');if(!selected){onChange(null);return;}if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5*1024*1024){setError('เลือกรูป JPG, PNG หรือ WebP ไม่เกิน 5MB');onChange(null);event.target.value='';return;}onChange(selected);}}/></label>

 {file?<button type="button" className="secondary" disabled={disabled} onClick={()=>{onChange(null);const input=document.getElementById('product-image');if(input instanceof HTMLInputElement)input.value='';}}><X size={16}/>ล้างรูปที่เลือก</button>:null}
 {error?<Notice>{error}</Notice>:null}</section>;
}

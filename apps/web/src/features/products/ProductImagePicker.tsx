import { useEffect,useState } from 'react';
import { ImagePlus,X } from 'lucide-react';
import { Notice } from '../../components/Notice';
export function ProductImagePicker({file,onChange,currentUrl,disabled}:{file:File|null;onChange:(file:File|null)=>void;currentUrl?:string|null;disabled:boolean}){
 const [preview,setPreview]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 return <section className="product-image-picker"><label className="field" htmlFor="product-image"><span><ImagePlus size={18} aria-hidden="true"/> รูปสินค้า (ไม่บังคับ)</span><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event=>{const selected=event.target.files?.[0];setError('');if(!selected){onChange(null);return;}if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5*1024*1024){setError('เลือกรูป JPG, PNG หรือ WebP ไม่เกิน 5MB');onChange(null);event.target.value='';return;}onChange(selected);}}/></label>
 <p className="product-note">JPG, PNG หรือ WebP ไม่เกิน 5MB · ไม่เลือกรูปก็เพิ่มสินค้าได้</p>
 {preview||currentUrl?<img className="product-image-preview" src={preview||currentUrl!} alt="ตัวอย่างรูปสินค้า"/>:null}
 {file?<button type="button" className="secondary" disabled={disabled} onClick={()=>{onChange(null);const input=document.getElementById('product-image');if(input instanceof HTMLInputElement)input.value='';}}><X size={16}/>ล้างรูปที่เลือก</button>:null}
 {error?<Notice>{error}</Notice>:null}</section>;
}

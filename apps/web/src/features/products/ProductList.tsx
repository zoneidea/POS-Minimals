import { Pencil,Trash2,ArrowDownUp,History } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import type { Product } from './client';
const currency=new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export function ProductList({items,total,page,onPageChange,disabled,onEdit,onDelete,onAdjust,onHistory,categories,error=false,loading=false}:{items:Product[];total:number;page:number;onPageChange:(page:number)=>void;disabled:boolean;onEdit:(item:Product)=>void;onDelete:(item:Product)=>void;onAdjust:(item:Product)=>void;onHistory:(item:Product)=>void;categories:Map<string,string>;error?:boolean;loading?:boolean}){
 return <DataTable error={error} loading={loading} label="คลังสินค้า" rows={items} rowKey={item=>item.id} total={total} page={page} onPageChange={onPageChange} disabled={disabled} emptyMessage="ไม่มีข้อมูลสินค้า" columns={[
 {key:'image',header:'รูป',render:item=><img className="product-thumbnail" src={item.imageUrl??'https://placehold.co/64x64/f3f4f6/9ca3af?text=Product'} alt={`รูป ${item.name}`} loading="lazy"/>},
 {key:'barcode',header:'บาร์โค้ด',render:item=>item.barcode},
 {key:'name',header:'ชื่อสินค้า',render:item=>item.name},
 {key:'category',header:'หมวดหมู่',render:item=>item.categoryId?categories.get(item.categoryId)??'ไม่พบหมวดหมู่':'ไม่ระบุ'},
 {key:'quantity',header:'คงเหลือ',render:item=><span className={item.quantity===0?'stock-empty':item.quantity<=5?'stock-low':'stock-normal'}>{item.quantity} {item.quantity===0?'· หมดสต็อก':item.quantity<=5?'· ใกล้หมด':''}</span>},
 {key:'cost',header:'ต้นทุน (บาท)',render:item=>currency.format(Number(item.unitCost))},
 {key:'price',header:'ราคาขาย (บาท)',render:item=>currency.format(Number(item.salePrice))},
 {key:'actions',header:'จัดการ',className:'table-actions',render:item=><div className="category-actions"><button type="button" className="secondary" disabled={disabled} aria-label={`ปรับสต็อก ${item.name}`} title="ปรับสต็อก" onClick={()=>onAdjust(item)}><ArrowDownUp size={16}/></button><button type="button" className="secondary" disabled={disabled} aria-label={`ประวัติสต็อก ${item.name}`} title="ประวัติสต็อก" onClick={()=>onHistory(item)}><History size={16}/></button><button type="button" className="secondary" disabled={disabled} aria-label={`แก้ไข ${item.name}`} onClick={()=>onEdit(item)}><Pencil size={16}/>แก้ไข</button><button type="button" className="secondary danger" disabled={disabled} aria-label={`ลบ ${item.name}`} onClick={()=>onDelete(item)}><Trash2 size={16}/>ลบ</button></div>}
 ]}/>;
}

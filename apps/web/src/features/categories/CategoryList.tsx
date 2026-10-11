import { Pencil, Trash2, Tags } from 'lucide-react';
import type { Category } from './client';
export function CategoryList({items,onEdit,onDelete,disabled}:{items:Category[];onEdit:(item:Category)=>void;onDelete:(item:Category)=>void;disabled:boolean}){
 if(!items.length)return <div className="category-empty"><Tags size={36} aria-hidden="true"/><h2>ยังไม่มีหมวดหมู่</h2><p>เพิ่มหมวดหมู่เพื่อเตรียมจัดกลุ่มสินค้าในร้าน</p></div>;
 return <ul className="category-list">{items.map(item=><li key={item.id}><span><Tags size={18} aria-hidden="true"/>{item.name}</span><div className="category-actions"><button className="secondary" disabled={disabled} onClick={()=>onEdit(item)} aria-label={`แก้ไข ${item.name}`}><Pencil size={16} aria-hidden="true"/>แก้ไข</button><button className="secondary danger" disabled={disabled} onClick={()=>onDelete(item)} aria-label={`ลบ ${item.name}`}><Trash2 size={16} aria-hidden="true"/>ลบ</button></div></li>)}</ul>;
}

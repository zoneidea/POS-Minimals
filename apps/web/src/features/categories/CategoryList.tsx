import { Pencil, Trash2 } from 'lucide-react';
import type { Category } from './client';
import { DataTable } from '../../components/DataTable';
export function CategoryList({items,onEdit,onDelete,disabled,total,page,onPageChange}:{items:Category[];onEdit:(item:Category)=>void;onDelete:(item:Category)=>void;disabled:boolean;total:number;page:number;onPageChange:(page:number)=>void}){
 return <DataTable label="หมวดหมู่สินค้า" rows={items} rowKey={item=>item.id} total={total} page={page} onPageChange={onPageChange} disabled={disabled} emptyMessage="ยังไม่มีหมวดหมู่สินค้า" columns={[
 {key:'number',header:'ลำดับ',render:item=>(page-1)*10+items.indexOf(item)+1,className:'table-number'},
 {key:'name',header:'ชื่อหมวดหมู่',render:item=>item.name},
 {key:'actions',header:'จัดการ',className:'table-actions',render:item=><div className="category-actions"><button type="button" className="secondary" disabled={disabled} onClick={()=>onEdit(item)} aria-label={`แก้ไข ${item.name}`}><Pencil size={16} aria-hidden="true"/>แก้ไข</button><button type="button" className="secondary danger" disabled={disabled} onClick={()=>onDelete(item)} aria-label={`ลบ ${item.name}`}><Trash2 size={16} aria-hidden="true"/>ลบ</button></div>},
 ]}/>;
}

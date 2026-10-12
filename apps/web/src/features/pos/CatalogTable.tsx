import { DataTable } from '../../components/DataTable';
import type { CatalogProduct } from './client';
export function CatalogTable({items,total,page,onPageChange,onAdd}:{items:CatalogProduct[];total:number;page:number;onPageChange:(page:number)=>void;onAdd:(product:CatalogProduct)=>void}) {
 return <DataTable label="สินค้าหน้าขาย" rows={items} rowKey={item=>item.id} total={total} page={page} onPageChange={onPageChange} emptyMessage="ไม่พบสินค้า ลองเปลี่ยนคำค้นหรือเพิ่มสินค้าที่คลังสินค้า" columns={[
  {key:'barcode',header:'บาร์โค้ด',render:item=>item.barcode},
  {key:'name',header:'ชื่อสินค้า',render:item=><button className="pos-list-add" disabled={item.quantityOnHand===0} aria-label={`เพิ่ม ${item.name} ราคา ${item.salePrice} บาท`} onClick={()=>onAdd(item)}>{item.name}</button>},
  {key:'price',header:'ราคาขาย (บาท)',render:item=>item.salePrice},
  {key:'stock',header:'คงเหลือ',render:item=><span className={item.quantityOnHand===0?'stock-empty':item.quantityOnHand<=5?'stock-low':'stock-normal'}>{item.quantityOnHand===0?'หมดสต็อก':item.quantityOnHand}</span>}
 ]}/>;
}

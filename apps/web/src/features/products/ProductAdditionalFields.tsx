import {Barcode,Package,Banknote,RefreshCw} from 'lucide-react';
import {Field} from '../../components/Field';
import {Busy,Notice} from '../../components/Notice';
import {ProductMediaFields,type ProductMediaProps} from './ProductMediaFields';
type Props=ProductMediaProps&{cafe:boolean;barcode:string;saved:boolean;onRetry:()=>void};
export function ProductAdditionalFields(p:Props){
 const fields=<><Field id="product-barcode" name="barcode" label="บาร์โค้ด" icon={Barcode} defaultValue={p.barcode} maxLength={100} required autoFocus={!p.cafe} disabled={p.busy}/>{!p.cafe?<Field id="product-name" name="name" label="ชื่อสินค้า" icon={Package} defaultValue={p.item?.name??''} maxLength={200} required disabled={p.busy}/>:null}{!p.cafe?<ProductMediaFields {...p}/>:null}{!p.cafe&&(p.loading?<div role="status"><Busy/>กำลังโหลดหมวดหมู่</div>:p.error?<><Notice>{p.error}</Notice><button type="button" className="secondary" onClick={p.onRetry}><RefreshCw size={16}/>ลองโหลดหมวดหมู่ใหม่</button></>:null)}<div className="product-prices"><Field id="product-cost" name="unitCost" label="ต้นทุน (บาท)" icon={Banknote} inputMode="decimal" defaultValue={p.item?.unitCost??'0'} required disabled={p.busy}/>{!p.cafe?<Field id="product-price" name="salePrice" label="ราคาขาย (บาท)" icon={Banknote} inputMode="decimal" defaultValue={p.item?.salePrice??'0'} required disabled={p.busy}/>:null}</div>{!p.item&&!p.cafe?<Field id="product-quantity" name="initialQuantity" label="จำนวนสินค้าเริ่มต้น" icon={Package} type="number" min={0} max={2147483647} step="1" defaultValue="0" required disabled={p.busy||p.saved}/>:null}</>;
 return p.cafe?<details className="cafe-product-additional"><summary>ข้อมูลเพิ่มเติม · บาร์โค้ด / ต้นทุน</summary><div>{fields}</div></details>:fields;
}

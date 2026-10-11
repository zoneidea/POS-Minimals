import { Search,ScanBarcode } from 'lucide-react';
import { Field } from '../../components/Field';
export function CatalogSearch({onSearch}:{onSearch:(search:string,barcode:string)=>void}) {
 return <form className="catalog-search" onSubmit={event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);onSearch(String(data.get('search')).trim(),String(data.get('barcode')).trim());
 }}><Field id="pos-search" name="search" label="ค้นหาชื่อหรือบาร์โค้ด" icon={Search} maxLength={200} autoComplete="off"/>
 <Field id="pos-barcode" name="barcode" label="สแกนบาร์โค้ด (ตรงทั้งหมด)" icon={ScanBarcode} maxLength={100} autoComplete="off"/>
 <button className="primary" type="submit"><Search size={18} aria-hidden="true"/>ค้นหา</button></form>;
}

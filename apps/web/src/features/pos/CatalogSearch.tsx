import { Search } from 'lucide-react';
export function CatalogSearch({onSearch}:{onSearch:(search:string,barcode:string)=>void}) {
 return <form className="pos-search" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);onSearch(String(data.get('search')).trim(),'');}}><Search size={18} aria-hidden="true"/><input name="search" aria-label="ค้นหาสินค้า" placeholder="ค้นหาสินค้า / SKU / สแกนบาร์โค้ด แล้วกด Enter" maxLength={200} autoComplete="off"/><button type="submit" aria-label="ค้นหา"><Search size={18}/></button></form>;
}

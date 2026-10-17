import {useState} from 'react';
import {Construction} from 'lucide-react';
import {ModuleCard} from './ModuleCard';
import {ModuleDetailsModal} from './ModuleDetailsModal';
import {previewModules,type MarketplaceModule} from './modules';
import './marketplace.css';
export function MarketplacePage(){
 const [selected,setSelected]=useState<MarketplaceModule|null>(null);
 return <section className="marketplace-page" aria-label="Marketplace"><div className="marketplace-development-banner" role="note"><Construction size={22} aria-hidden="true"/><div><strong>กำลังพัฒนา</strong><p>ข้อมูลโมดูลและราคาเป็นตัวอย่างสำหรับเตรียมหน้าจอ ยังไม่เปิดให้ซื้อหรือชำระเงิน</p></div></div><div className="marketplace-grid">{previewModules.map(module=><ModuleCard key={module.id} module={module} onSelect={setSelected}/>)}</div>{selected?<ModuleDetailsModal module={selected} onClose={()=>setSelected(null)}/>:null}</section>;
}

import {useModuleAccess} from './ModuleAccess';
import {Notice} from '../../components/Notice';
import {useState} from 'react';
import {Construction} from 'lucide-react';
import {ModuleCard} from './ModuleCard';
import {ModuleDetailsModal} from './ModuleDetailsModal';
import {previewModules,type MarketplaceModule} from './modules';
import './marketplace.css';
export function MarketplacePage(){
 const access=useModuleAccess();
 const [selected,setSelected]=useState<MarketplaceModule|null>(null);
 return <section className="marketplace-page" aria-label="Marketplace"><div className="marketplace-development-banner" role="note"><Construction size={22} aria-hidden="true"/><div><strong>กำลังพัฒนา</strong><p>โมดูลคูปอง/ส่วนลดเปิดให้ทดลองซื้อฟรี ยังไม่เรียกเก็บเงินจริง โมดูลตัวอย่างอื่นยังไม่เปิดใช้งาน</p></div></div>{access.error?<Notice>{access.error}</Notice>:null}<div className="marketplace-grid">{previewModules.map(module=><ModuleCard key={module.id} module={module} purchased={module.id==='coupons'&&access.purchasedCoupons} enabled={module.id==='coupons'&&access.coupons} onSelect={setSelected}/>)}</div>{selected?<ModuleDetailsModal module={selected} onClose={()=>setSelected(null)}/>:null}</section>;
}

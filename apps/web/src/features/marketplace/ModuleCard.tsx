import {ArrowUpRight,Boxes} from 'lucide-react';
import {billingLabels,modulePrice,type MarketplaceModule} from './modules';
export function ModuleCard({module,onSelect}:{module:MarketplaceModule;onSelect:(module:MarketplaceModule)=>void}){
 return <button type="button" className="marketplace-card" onClick={()=>onSelect(module)} aria-label={`ดูรายละเอียด ${module.name}`}><span className="marketplace-card-top"><Boxes size={24} aria-hidden="true"/><span className="marketplace-billing">{billingLabels[module.billingType]}</span><ArrowUpRight size={18} aria-hidden="true"/></span><span className="marketplace-module-name">{module.name}</span><span className="marketplace-card-price">{modulePrice(module)}</span></button>;
}

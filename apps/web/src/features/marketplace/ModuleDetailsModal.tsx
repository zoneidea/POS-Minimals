import {useState} from 'react';
import {buyCouponDemo} from '../coupons/client';
import {useModuleAccess} from './ModuleAccess';
import {confirmAlert,successAlert,warningAlert} from '../../lib/alerts';
import {authMessage} from '../../lib/client';
import {ShoppingBag} from 'lucide-react';
import {Modal} from '../../components/Modal';
import {billingLabels,modulePrice,type MarketplaceModule} from './modules';
export function ModuleDetailsModal({module,onClose}:{module:MarketplaceModule;onClose:()=>void}){
 const access=useModuleAccess(),[busy,setBusy]=useState(false),demo=module.id==='coupons';
 const buy=async()=>{if(busy)return;setBusy(true);try{if(!await confirmAlert('ทดลองซื้อโมดูลคูปอง/ส่วนลดฟรี ไม่มีการเรียกเก็บเงิน ยืนยันหรือไม่?'))return;const result=await buyCouponDemo();if(!result.coupons)throw new Error('Module disabled');access.refresh();await successAlert('เปิดใช้งานโมดูลคูปองแล้ว');onClose();}catch(e){await warningAlert(authMessage(e));}finally{setBusy(false);}};
 return <Modal busy={busy} title={module.name} onClose={onClose}><div className="marketplace-details"><p className="marketplace-development">{demo?'กำลังพัฒนา · ทดลองซื้อฟรี':'กำลังพัฒนา · ข้อมูลตัวอย่าง'}</p><div className="marketplace-detail-price"><span className="marketplace-billing">{billingLabels[module.billingType]}</span><strong>{modulePrice(module)}</strong></div><p>{module.description}</p><h3>รายละเอียดการทำงาน</h3><ul>{module.features.map(feature=><li key={feature}>{feature}</li>)}</ul>{module.billingType==='MONTHLY'?<p className="marketplace-monthly-note">ไม่มีการต่ออายุหรือหักเงินอัตโนมัติ</p>:null}<p id={`marketplace-unavailable-${module.id}`} className="marketplace-unavailable">{demo?(access.coupons?'ร้านนี้ซื้อโมดูลแล้ว พร้อมใช้งาน':'การซื้อจำลองจะเปิดใช้งานให้ร้านนี้ โดยไม่เรียกเก็บเงิน'):'กำลังพัฒนา ยังไม่เปิดให้ซื้อโมดูล'}</p><div className="marketplace-modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>ปิด</button><button type="button" className="primary" disabled={!demo||busy||access.loading||access.coupons||Boolean(access.error)} onClick={()=>void buy()} aria-describedby={`marketplace-unavailable-${module.id}`}><ShoppingBag size={18} aria-hidden="true"/>{demo?(access.coupons?'ซื้อแล้ว':busy?'กำลังเปิดใช้งาน':'ซื้อจำลองฟรี'):'ซื้อ'}</button></div></div></Modal>;
}

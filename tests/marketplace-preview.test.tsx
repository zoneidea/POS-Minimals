import {it,expect,vi,afterEach} from 'vitest';
// SSR preview checks are offline and must not initialize the browser Auth client.
vi.mock('../apps/web/src/lib/client',()=>({auth:{auth:{getSession:vi.fn()}},request:vi.fn(),authMessage:()=> 'Offline preview'}));
import {renderToString} from 'react-dom/server';
import {MarketplacePage} from '../apps/web/src/features/marketplace/MarketplacePage';
import {ModuleDetailsModal} from '../apps/web/src/features/marketplace/ModuleDetailsModal';
import {previewModules} from '../apps/web/src/features/marketplace/modules';
it('shows an explicit development preview without fabricated prices or checkout links',()=>{
 const html=renderToString(<MarketplacePage/>);
 expect(html).toContain('กำลังพัฒนา');expect(html).toContain('ยังไม่เรียกเก็บเงินจริง');expect(html).toContain('คูปอง/ส่วนลด');
 expect(html).toContain('รอกำหนดราคา');expect(html).toContain('ซื้อขาด');expect(html).toContain('รายเดือน');
 expect(html).not.toMatch(/href=|action=|payment_session_id/);
});
it('keeps purchase unavailable inside module details and explains no automatic renewal for monthly access',()=>{
 const module=previewModules.find(module=>module.billingType==='MONTHLY')!;
 const html=renderToString(<ModuleDetailsModal module={module} onClose={()=>{}}/>);
 expect(html).toContain('รายละเอียดการทำงาน');expect(html).toContain('ไม่มีการต่ออายุหรือหักเงินอัตโนมัติ');
 expect(html).toContain('กำลังพัฒนา ยังไม่เปิดให้ซื้อโมดูล');
 expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?ซื้อ<\/button>/);
 expect(html).not.toContain('<form');
});

import * as moduleAccess from '../apps/web/src/features/marketplace/ModuleAccess';
import {moduleAccessState} from '../apps/web/src/features/marketplace/entitlement-state';
afterEach(()=>vi.restoreAllMocks());
it('shows owned-disabled modules without offering a second purchase and keeps activation separate',()=>{
 for(const enabled of [false,true]){
  vi.spyOn(moduleAccess,'useModuleAccess').mockReturnValue({...moduleAccessState({coupons:enabled,purchased:{coupons:true}}),refresh:vi.fn(),applyEntitlements:vi.fn()});
  const html=renderToString(<ModuleDetailsModal module={previewModules[0]!} onClose={()=>{}}/>);
  expect(html).toContain(enabled?'ปิดใช้งานโมดูล':'เปิดใช้งานโมดูล');expect(html).not.toContain('ซื้อจำลองฟรี');
  if(!enabled){expect(html).toContain('โดยไม่ต้องซื้อใหม่');expect(renderToString(<MarketplacePage/>)).toContain('ซื้อแล้ว · ปิดใช้งาน');}
 }
 expect(moduleAccessState({coupons:true}).purchasedCoupons).toBe(true);
 expect(moduleAccessState({coupons:false,purchased:{coupons:true}})).toMatchObject({coupons:false,purchasedCoupons:true});
});

import {it,expect} from 'vitest';
import {renderToString} from 'react-dom/server';
import {MarketplacePage} from '../apps/web/src/features/marketplace/MarketplacePage';
import {ModuleDetailsModal} from '../apps/web/src/features/marketplace/ModuleDetailsModal';
import {previewModules} from '../apps/web/src/features/marketplace/modules';
it('shows an explicit development preview without fabricated prices or checkout links',()=>{
 const html=renderToString(<MarketplacePage/>);
 expect(html).toContain('กำลังพัฒนา');expect(html).toContain('ยังไม่เปิดให้ซื้อหรือชำระเงิน');
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

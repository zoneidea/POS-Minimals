import { expect,it } from 'vitest';
import { revenueWindow,revenuePoints } from '../apps/web/src/features/reports/revenue-data';
it('uses Bangkok current date and six ascending months across year boundaries',()=>{
 const window=revenueWindow(new Date('2025-12-31T18:00:00Z'));
 expect(window.to).toBe('2026-01-01');expect(window.from).toBe('2025-08-01');expect(window.months).toEqual(['2025-08-01','2025-09-01','2025-10-01','2025-11-01','2025-12-01','2026-01-01']);
});
it('preserves exact monetary text, sorts by calendar and fills months without sales with zero',()=>{
 const row={period:'2026-01-01',net:'123456789012345.67',gross:'0.00',discount:'0.00',vat:'0.00',billCount:1,voidCount:0,voidAmount:'0.00'};
 const result=revenuePoints(['2025-12-01','2026-01-01'],[row]);expect(result.map(point=>point.amount)).toEqual(['0.00','123456789012345.67']);expect(result.map(point=>point.period)).toEqual(['2025-12-01','2026-01-01']);
});

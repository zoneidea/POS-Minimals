import {it,expect} from 'vitest';
import {gatewayConfirmation,gatewayLocalDeadline} from '../apps/web/src/features/payments/gateway-clock';
it('aligns the existing provider deadline to server time despite a wrong POS clock',()=>{
 const result=gatewayConfirmation.parse({status:'PENDING',expiresAt:'2026-10-29T05:10:00Z',serverTime:'2026-10-29T05:00:00Z'});
 expect(gatewayLocalDeadline(result,1000)).toBe(601000);
 expect(gatewayLocalDeadline({...result,serverTime:'2026-10-29T05:11:00Z'},1000)).toBe(-59000);
 expect(gatewayLocalDeadline({status:'PENDING'})).toBeNull();
 expect(gatewayLocalDeadline({...result,expiresAt:null})).toBeNull();
 expect(gatewayConfirmation.safeParse({...result,expiresAt:'bad'}).success).toBe(false);
});

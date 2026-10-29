import {it,expect,vi,afterEach} from 'vitest';
import {readGatewayPending,saveGatewayPending,clearGatewayPending,archiveExpiredGateway} from '../apps/web/src/features/payments/gateway-pending';
afterEach(()=>vi.unstubAllGlobals());
it('archives expired references before clearing and never erases a pending attempt on storage failure',()=>{
 const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});
 archiveExpiredGateway('a','pse_old','44.00');archiveExpiredGateway('a','pse_old','44.00');
 expect(JSON.parse(data.get('pos:gateway-expired:a')!)).toHaveLength(1);
 expect(data.has('pos:gateway-expired:b')).toBe(false);
 const pending={sessionId:'pse_old',amount:'44.00',cart:{items:[],discountAmount:'0.00'}};
 saveGatewayPending('a',pending);data.set('pos:gateway-expired:a','bad JSON');
 expect(()=>archiveExpiredGateway('a','pse_old','44.00')).toThrow();expect(readGatewayPending('a')).toEqual(pending);
});
it('retains the original session/amount/cart across reload and isolates shops and users',()=>{const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});const pending={sessionId:'pse_test',amount:'44.00',cart:{items:[{productId:'00000000-0000-4000-8000-000000000001',quantity:2}],discountAmount:'0.00'}};saveGatewayPending('userA:shopA',pending);expect(readGatewayPending('userA:shopA')).toEqual(pending);expect(readGatewayPending('userA:shopB')).toBeNull();expect(readGatewayPending('userB:shopA')).toBeNull();clearGatewayPending('userA:shopA');expect(readGatewayPending('userA:shopA')).toBeNull();});

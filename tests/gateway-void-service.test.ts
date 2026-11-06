import {beforeEach,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../apps/api/src/infra/supabase/user-client',()=>({createUserClient:()=>({rpc:mock.rpc})}));
import {createSaleManagementService} from '../apps/api/src/modules/sales/void-service';
const id='00000000-0000-4000-8000-000000000002',request='00000000-0000-4000-8000-000000000003';
const result={saleId:id,status:'VOIDED',voidedAtUtc:'2026-11-06T05:00:00Z',replayed:false};
beforeEach(()=>{mock.rpc.mockReset();mock.rpc.mockResolvedValue({data:result,error:null});});
it('cancels through the atomic cash-refund RPC without any ReservePay calls',async()=>{const send=vi.fn(),resolve=vi.fn();const service=createSaleManagementService('https://example.test','key','11'.repeat(32),'secret','api-key',send,resolve);expect(await service.void('token',id,'cash refund',request)).toEqual(result);expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('void_sale_cash_refund',{p_id:id,p_reason:'cash refund',p_request_id:request});expect(send).not.toHaveBeenCalled();expect(resolve).not.toHaveBeenCalled();});
it('preserves forbidden, tenant and same-day errors without provider refund',async()=>{const send=vi.fn(),service=createSaleManagementService('url','key','11'.repeat(32),undefined,undefined,send,vi.fn());for(const [code,message,status] of [['PT403','FORBIDDEN',403],['PT404','NOT_FOUND',404],['PT409','VOID_WINDOW_EXPIRED',409]] as const){mock.rpc.mockResolvedValueOnce({data:null,error:{code,message}});await expect(service.void('token',id,'cash refund',request)).rejects.toMatchObject({status,code:message});}expect(send).not.toHaveBeenCalled();});

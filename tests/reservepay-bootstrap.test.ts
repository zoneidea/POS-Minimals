import {describe,it,expect,vi} from 'vitest';
import {createBootstrapService} from '../apps/api/src/modules/orgs/service.js';
import {encryptStoreContact} from '../apps/api/src/modules/orgs/contact-cipher.js';
const mocks=vi.hoisted(()=>({verify:vi.fn(),provision:vi.fn(),single:vi.fn()}));
vi.mock('../apps/api/src/infra/supabase/user-client.js',()=>({verifyUser:mocks.verify,createUserClient:()=>({from:()=>({select:()=>({eq:()=>({is:()=>({single:mocks.single})})})})})}));
vi.mock('../apps/api/src/modules/orgs/repository.js',()=>({provisionOrganization:mocks.provision}));
const key='ab'.repeat(32),result={orgId:'00000000-0000-4000-8000-000000000001',role:'OWNER',status:'ACTIVE'};
describe('store bootstrap contact ordering',()=>{
 it('sends persisted values after provisioning rather than changed retry form values',async()=>{mocks.verify.mockResolvedValue({email:'verified@example.com',email_confirmed_at:'2026-10-14'});mocks.provision.mockResolvedValue(result);mocks.single.mockResolvedValue({data:{store_name:'Saved Shop',private_cipher:encryptStoreContact('0812345678',key)},error:null});const sync=vi.fn().mockResolvedValue('SENT');expect(await createBootstrapService('url','key',key,sync)('jwt',{storeName:'Changed retry',phone:'0899999999',displayUsername:'Owner'},'request')).toEqual({...result,reservePayStatus:'SENT'});expect(sync).toHaveBeenCalledWith({orgId:result.orgId,email:'verified@example.com',phone:'0812345678',storeName:'Saved Shop'},'request');expect(mocks.provision.mock.invocationCallOrder.at(-1)!).toBeLessThan(sync.mock.invocationCallOrder[0]!);});
 it('preserves successful store creation when external delivery is uncertain',async()=>{const sync=vi.fn().mockResolvedValue('UNKNOWN');expect(await createBootstrapService('url','key',key,sync)('jwt',{storeName:'Shop',phone:'0812345678',displayUsername:'Owner'},'request')).toEqual({...result,reservePayStatus:'UNKNOWN'});});
 it('does not call ReservePay when provisioning fails',async()=>{mocks.provision.mockRejectedValueOnce(new Error('provision failed'));const sync=vi.fn();await expect(createBootstrapService('url','key',key,sync)('jwt',{storeName:'Shop',phone:'0812345678',displayUsername:'Owner'},'request')).rejects.toThrow('provision failed');expect(sync).not.toHaveBeenCalled();});
});

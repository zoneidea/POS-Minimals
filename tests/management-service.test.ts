import { expect,it,vi } from 'vitest';
const client=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('../apps/api/src/infra/supabase/user-client.js',()=>({createUserClient:()=>client}));
import { createManagementService } from '../apps/api/src/modules/management/service';
const context={userId:'90000000-0000-4000-8000-000000000001',orgId:'90000000-0000-4000-8000-000000000002',orgName:'Shop',username:'alias',role:'OWNER' as const,permissions:[]};
it('encrypts private store fields with randomized authenticated ciphertext and decrypts only on owner service read',async()=>{
 const service=createManagementService('https://example.supabase.co','public-key','a'.repeat(64));
 const input={storeName:'Shop',address:'private address',phone:'0812345678',taxId:'1234567890123',promptpayIdentifier:'0812345678',receiptFooter:'Thanks',vatEnabled:true,vatRate:'7.00',autoOpenPrintDialog:true,version:1};
 client.rpc.mockResolvedValue({data:{version:2},error:null});
 await service.saveSettings('token',input,'90000000-0000-4000-8000-000000000003');const first=client.rpc.mock.calls.at(-1)![1].p_input;
 await service.saveSettings('token',input,'90000000-0000-4000-8000-000000000003');const second=client.rpc.mock.calls.at(-1)![1].p_input;
 expect(first.privateCipher).not.toBe(second.privateCipher);for(const value of [input.address,input.phone,input.taxId])expect(JSON.stringify(first)).not.toContain(value);expect(first).not.toHaveProperty('phone');
 const row={store_name:'Shop',receipt_footer:'Thanks',vat_enabled:true,vat_rate:7,auto_open_print_dialog:true,row_version:2,private_cipher:first.privateCipher};
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:row,error:null})};client.from.mockReturnValue(query);
 expect(await service.settings('token',context)).toMatchObject({address:input.address,phone:input.phone,taxId:input.taxId,version:2});
 await expect(createManagementService('https://example.supabase.co','public-key','b'.repeat(64)).settings('token',context)).rejects.toThrow();
});
it('does not invoke Auth Admin when invitation secret is missing',async()=>{await expect(createManagementService('https://example.supabase.co','public-key','a'.repeat(64)).invite('token',{email:'staff@example.com',role:'EMPLOYEE'},'90000000-0000-4000-8000-000000000003')).rejects.toMatchObject({status:503,code:'INVITATION_NOT_CONFIGURED'});});

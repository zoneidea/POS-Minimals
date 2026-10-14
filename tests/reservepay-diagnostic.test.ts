import {describe,it,expect} from 'vitest';
import {safeProviderError,readProviderError} from '../apps/api/src/modules/orgs/reservepay-diagnostic.js';
const contact={orgId:'store-id',email:'owner@example.com',phone:'0812345678',storeName:'Private Shop'};
describe('safe ReservePay diagnostics',()=>{
 it('retains validation cause and redacts submitted data and credentials',()=>{const result=safeProviderError(JSON.stringify({message:'contact_mobile 0812345678 invalid for owner@example.com Private Shop Bearer secret-key',data:{other:'sensitive'}}),contact,'secret-key');const text=JSON.stringify(result);expect(text).toContain('invalid');for(const value of Object.values(contact).concat('secret-key','sensitive'))expect(text).not.toContain(value);});
 it('does not retain unstructured responses',()=>{expect(safeProviderError('<html>secret</html>',contact,'secret').messages[0]).toContain('not valid JSON');});
 it('limits response size',async()=>{expect((await readProviderError(new Response('x'.repeat(17000)),contact,'key')).messages[0]).toContain('exceeded');});
});

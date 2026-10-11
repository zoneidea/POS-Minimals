import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
let client: typeof import('../apps/web/src/lib/client');
beforeAll(async()=>{vi.stubEnv('VITE_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','test-public-key');client=await import('../apps/web/src/lib/client');});
afterEach(()=>vi.unstubAllGlobals());
describe('Web API boundary',()=>{
 it('sends user token and bootstrap payload to same-origin API',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true,data:{orgId:'new'}})});vi.stubGlobal('fetch',fetch);expect(await client.request('/orgs/bootstrap','user-token',{storeName:'ร้าน',displayUsername:'เจ้าของ'})).toEqual({orgId:'new'});const [url,options]=fetch.mock.calls[0]!;expect(url).toBe('/api/v1/orgs/bootstrap');expect(options.headers.Authorization).toBe('Bearer user-token');expect(JSON.parse(options.body)).toEqual({storeName:'ร้าน',displayUsername:'เจ้าของ'});});
 it('retains forbidden status for recovery without assuming authorization',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:{message:'บัญชีถูกระงับ'}})}));await expect(client.identity('token')).rejects.toMatchObject({status:403,message:'บัญชีถูกระงับ'});});
 it('rejects malformed identity rather than displaying trusted role',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{role:'OWNER'}})}));await expect(client.identity('token')).rejects.toThrow();});
 it('does not display raw provider error or credentials',()=>{expect(client.authMessage(new Error('secret-token'))).not.toContain('secret-token');expect(client.authMessage({code:'invalid_credentials'})).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');});
});

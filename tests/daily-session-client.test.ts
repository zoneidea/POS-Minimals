import {it,expect,vi} from 'vitest';
it('does not refresh a session rejected for crossing the Thai calendar day',async()=>{
 vi.stubEnv('VITE_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','test-public-key');
 const client=await import('../apps/web/src/lib/client');const boundary=await import('../apps/web/src/lib/session-identity');const refresh=vi.spyOn(client.auth.auth,'refreshSession');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({error:{code:'SESSION_DAY_EXPIRED',message:'Expired'}})}));
 try{await expect(boundary.identityWithRefresh('old','user')).rejects.toBeInstanceOf(boundary.SessionExpiredError);expect(refresh).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();}
});

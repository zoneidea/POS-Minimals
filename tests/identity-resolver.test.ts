import { afterEach,expect,it,vi } from 'vitest';
import { createIdentityResolver } from '../apps/api/src/modules/auth/resolver';
const uid='00000000-0000-4000-8000-000000000001',org='00000000-0000-4000-8000-000000000002';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function backend(rows:unknown[],authStatus=200,dbStatus=200){
 const calls:{url:URL;headers:Headers}[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
  const url=new URL(input instanceof Request?input.url:String(input));calls.push({url,headers:new Headers(init?.headers)});
  const auth=url.pathname==='/auth/v1/user';
  return new Response(JSON.stringify(auth?(authStatus===200?{id:uid,email_confirmed_at:new Date().toISOString()}:{message:'invalid token'}):(dbStatus===200?rows:{message:'database unavailable'})),{status:auth?authStatus:dbStatus,headers:{'content-type':'application/json'}});
 }));return calls;
}
it('verifies Auth then reads current membership and active organization in one user-scoped request',async()=>{
 const calls=backend([{org_id:org,user_id:uid,display_username:'Cashier',role:'EMPLOYEE',organizations:{name:'Shop'}}]);
 expect(await createIdentityResolver('https://supabase.example','public-key')('jwt-token')).toMatchObject({userId:uid,orgId:org,orgName:'Shop',role:'EMPLOYEE'});
 expect(calls).toHaveLength(2);expect(calls[0]!.url.pathname).toBe('/auth/v1/user');
 const query=calls[1]!.url;expect(query.pathname).toBe('/rest/v1/organization_members');
 expect(query.searchParams.get('select')).toContain('organizations!inner(name)');
 expect(query.searchParams.get('user_id')).toBe('eq.'+uid);
 expect(query.searchParams.get('status')).toBe('eq.ACTIVE');expect(query.searchParams.get('deleted_at')).toBe('is.null');
 expect(query.searchParams.get('organizations.status')).toBe('eq.ACTIVE');expect(query.searchParams.get('organizations.deleted_at')).toBe('is.null');
 expect(calls.every(call=>call.headers.get('authorization')==='Bearer jwt-token')).toBe(true);
});
it('denies missing/inactive membership or shop and propagates unavailable DB safely',async()=>{
 backend([]);await expect(createIdentityResolver('https://supabase.example','public-key')('jwt-token')).rejects.toMatchObject({status:403});
 vi.useFakeTimers();const calls=backend([],200,503);
 const rejection=expect(createIdentityResolver('https://supabase.example','public-key')('jwt-token')).rejects.toMatchObject({status:503});
 await vi.advanceTimersByTimeAsync(60000);await rejection;
 expect(calls.filter(call=>call.url.pathname==='/rest/v1/organization_members').length).toBeGreaterThan(1);
});
it('does not query membership when Auth rejects the token and never caches identity',async()=>{
 const calls=backend([],401);await expect(createIdentityResolver('https://supabase.example','public-key')('jwt-token')).rejects.toMatchObject({status:401});expect(calls).toHaveLength(1);
 const valid=backend([{org_id:org,user_id:uid,display_username:'Owner',role:'OWNER',organizations:{name:'Shop'}}]);
 const resolve=createIdentityResolver('https://supabase.example','public-key');await resolve('jwt-token');await resolve('jwt-token');expect(valid).toHaveLength(4);
});

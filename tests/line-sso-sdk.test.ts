import {it,expect,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {lineAuthKeys,selectedLineAuthKey} from '../apps/web/src/features/line/auth-storage';
import {handoffLineSession} from '../apps/web/src/features/line/session-handoff';
it('hands the real Supabase SDK session to the unchanged Web storage key and reopens it without password login',async()=>{
 const url='https://sso-sdk-fixture.supabase.co',keys=lineAuthKeys(url),id='00000000-0000-4000-8000-000000000001',orgId='00000000-0000-4000-8000-000000000002';
 const expiry=Math.floor(Date.now()/1000)+3600;
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const jwt=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',exp:expiry,iat:expiry-3600,iss:url+'/auth/v1',session_id:orgId})}.${Buffer.from('fixture-signature').toString('base64url')}`;
 const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.test',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
 const send=vi.fn(async(input:RequestInfo|URL)=>{const path=String(input);if(path.endsWith('/user'))return Response.json({user});if(path.includes('/token?grant_type=password'))return Response.json({access_token:jwt,refresh_token:'fixture-refresh',expires_in:3600,expires_at:expiry,token_type:'bearer',user});throw Error('Unexpected Auth call: '+new URL(path).pathname);});
 const rows=new Map<string,string>();const storage={getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>{rows.set(k,v);},removeItem:(k:string)=>{rows.delete(k);}};
 const client=(storageKey:string)=>createClient(url,'fixture-publishable',{auth:{storageKey,storage,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:send}});
 const source=client(keys.privateKey),target=client(keys.webKey);
 try{
  const login=await source.auth.signInWithPassword({email:'fixture@example.test',password:'fixture-only-password'});expect(login.error).toBeNull();expect(rows.has(keys.privateKey)).toBe(true);
  expect(await handoffLineSession({source:source.auth,createTarget:()=>target.auth,validate:async()=>({userId:id,orgId,expiresAt:new Date(expiry*1000).toISOString()}),confirmSwitch:async()=>false,storage,keys,activeKey:keys.privateKey,userId:id,orgId})).toBe(true);
  expect(rows.has(keys.privateKey)).toBe(false);expect(selectedLineAuthKey(keys,storage)).toBe(keys.webKey);
  const web=client(selectedLineAuthKey(keys,storage));try{const result=await web.auth.getSession();expect(result.error).toBeNull();expect(result.data.session?.user.id).toBe(id);expect(result.data.session?.access_token).toBe(jwt);}finally{await web.auth.stopAutoRefresh();}
  expect(send.mock.calls.filter(([path])=>String(path).includes('grant_type=password'))).toHaveLength(1);
 }finally{await source.auth.stopAutoRefresh();await target.auth.stopAutoRefresh();}
});

import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import type {UserContext} from '../../../../../packages/contracts/src/index';
import {lineAuth,lineApi,lineRequest,lineMessage,LineApiError} from './api';
import {recordLineEvent} from './diagnostics';
export function useLineSession(){
 const [session,setSession]=useState<Session|null>(null),[user,setUser]=useState<UserContext|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;lineAuth.auth.getSession().then(({data,error})=>{if(!active)return;setSession(data.session);if(error)setError(lineMessage(error));setLoading(Boolean(data.session));}).catch(()=>{if(active){setError('ไม่สามารถตรวจสอบบัญชีได้');setLoading(false);}});const {data}=lineAuth.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);if(!next){setUser(null);setLoading(false);}}});return()=>{active=false;data.subscription.unsubscribe();};},[]);
 useEffect(()=>{
  if(!session)return;let active=true,ending=false,timer:ReturnType<typeof setTimeout>|undefined,deadline=0;
  const controller=new AbortController();setLoading(true);setError('');setUser(null);
  const expire=()=>{if(!active||ending)return;ending=true;setUser(null);setSession(null);setLoading(false);setError('หมดเวลาการใช้งานของวัน กรุณาเข้าสู่ระบบใหม่');void lineAuth.auth.signOut({scope:'local'});};
  const check=()=>{if(!active||!deadline)return;if(Date.now()>=deadline)expire();else{clearTimeout(timer);timer=setTimeout(check,Math.min(deadline-Date.now(),2147483647));}};
  const load=async()=>{let token=session.access_token;try{
   let context:UserContext;
   try{context=await lineApi.identity(token,controller.signal);}catch(e){if(!(e instanceof LineApiError)||e.status!==401||e.code==='SESSION_DAY_EXPIRED')throw e;const refreshed=await lineAuth.auth.refreshSession();if(refreshed.error||!refreshed.data.session||refreshed.data.session.user.id!==session.user.id)throw e;token=refreshed.data.session.access_token;context=await lineApi.identity(token,controller.signal);}
   const policy=await lineApi.policy(token,controller.signal);if(!active||ending)return;deadline=Date.parse(policy.expiresAt);if(deadline<=Date.now()){expire();return;}setUser(context);check();
  }catch(e){if(active&&!ending){if(e instanceof LineApiError&&e.code==='SESSION_DAY_EXPIRED')expire();else setError(lineMessage(e));}}finally{if(active)setLoading(false);}};
  void load();window.addEventListener('kidtang:line:session-expired',expire);window.addEventListener('focus',check);window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',check);
  return()=>{active=false;controller.abort();clearTimeout(timer);window.removeEventListener('kidtang:line:session-expired',expire);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',check);};
 },[session?.user.id,revision]);
 return {session,user,loading,error,retry:()=>setRevision(v=>v+1),async signOut(){try{try{await lineRequest('/auth/logout',{method:'POST'});}catch(error){if(!(error instanceof LineApiError&&error.status===401))throw error;}const result=await lineAuth.auth.signOut({scope:'local'});if(result.error)throw result.error;setError('');recordLineEvent({event:'LOGOUT'});}catch(e){setError(lineMessage(e));}}};
}

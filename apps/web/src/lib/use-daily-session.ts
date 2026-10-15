import {useEffect,useRef} from 'react';
import type {Session} from '@supabase/supabase-js';
import {auth,authStorageKey,request,RequestError} from './client';
import {tokenSessionId,readDailyExpiry,writeDailyExpiry,clearDailyAuthStorage} from './daily-session-state';
export function useDailySession(session:Session|null,onExpired:()=>void){
 const callback=useRef(onExpired),remembered=useRef({sessionId:'',expires:0});callback.current=onExpired;
 useEffect(()=>{
  if(!session)return;
  const sessionId=tokenSessionId(session.access_token)??session.user.id;
  let disposed=false,ended=false,deadline=remembered.current.sessionId===sessionId?remembered.current.expires:0,timer:ReturnType<typeof setTimeout>|undefined;
  try{deadline=readDailyExpiry(localStorage,authStorageKey,sessionId)||deadline;}catch{/* Storage may be disabled. */}
  const expire=()=>{
   if(disposed||ended)return;ended=true;if(timer)clearTimeout(timer);
   callback.current();void auth.auth.stopAutoRefresh();
   const clear=()=>{try{clearDailyAuthStorage(localStorage,authStorageKey);}catch{/* API independently enforces expiration. */}};
   clear();void auth.auth.signOut({scope:'local'}).catch(()=>{}).finally(clear);
  };
  const check=()=>{if(disposed||ended||!deadline)return;if(Date.now()>=deadline){expire();return;}if(timer)clearTimeout(timer);timer=setTimeout(check,Math.min(deadline-Date.now(),2147483647));};
  if(deadline&&Date.now()>=deadline){expire();return()=>{disposed=true;};}
  const controller=new AbortController();
  void auth.auth.startAutoRefresh();check();
  const load=async()=>{try{const value=await request('/auth/session-policy',session.access_token,undefined,controller.signal);if(disposed||ended)return;deadline=Date.parse(value.expiresAt);if(!Number.isFinite(deadline))throw new Error('Invalid session expiry');remembered.current={sessionId,expires:deadline};try{writeDailyExpiry(localStorage,authStorageKey,sessionId,deadline);}catch{}check();}catch(error){if(disposed||ended)return;if(error instanceof RequestError&&error.code==='SESSION_DAY_EXPIRED'){expire();return;}if(!deadline)timer=setTimeout(()=>void load(),10000);}};
  void load();
  window.addEventListener('focus',check);window.addEventListener('pageshow',check);window.addEventListener('pos:session-day-expired',expire);document.addEventListener('visibilitychange',check);window.addEventListener('storage',check);
  return()=>{disposed=true;controller.abort();if(timer)clearTimeout(timer);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);window.removeEventListener('pos:session-day-expired',expire);document.removeEventListener('visibilitychange',check);window.removeEventListener('storage',check);};
 },[session?.access_token]);
}

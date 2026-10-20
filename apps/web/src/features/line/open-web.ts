import {createClient} from '@supabase/supabase-js';
import type {UserContext} from '../../../../../packages/contracts/src/index';
import {lineAuth,lineApi,lineAuthStorageKey,lineStorageKeys} from './api';
import {handoffLineSession} from './session-handoff';
import {confirmAlert} from '../../lib/alerts';
import {recordLineEvent} from './diagnostics';
let webAuth:ReturnType<typeof createClient>['auth']|undefined;
export async function openLineWebSession(user:UserContext,signal:AbortSignal){
 const ready=await handoffLineSession({source:lineAuth.auth,activeKey:lineAuthStorageKey,keys:lineStorageKeys,storage:localStorage,userId:user.userId,orgId:user.orgId,signal,
  createTarget:()=>webAuth??=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:lineStorageKeys.webKey,detectSessionInUrl:false,autoRefreshToken:false}}).auth,
  validate:async token=>{const [identity,policy]=await Promise.all([lineApi.identity(token,signal),lineApi.policy(token,signal)]);return {...identity,...policy};},
  confirmSwitch:()=>confirmAlert('ระบบเว็บมีบัญชีอื่นอยู่ ต้องการเปลี่ยนเป็นบัญชี KidTang ที่ใช้อยู่ใน LINE MINI App หรือไม่?'),
 });
 if(ready){recordLineEvent({event:'WEB_SSO_READY'});window.location.replace(user.role==='ACCOUNTANT'?'/reports':'/');}
}

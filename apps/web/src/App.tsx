import {useDailySession} from './lib/use-daily-session';
import { JoinPage } from './features/management/JoinPage';
import { navigateWorkspace, useWorkspacePath } from './lib/use-workspace-path';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RefreshCw } from 'lucide-react';
import type { UserContext } from '../../../packages/contracts/src/index';
import { auth, authMessage,signOutCurrentSession, RequestError, confirmationError } from './lib/client';
import { identityWithRefresh, SessionExpiredError } from './lib/session-identity';
import { SessionExpiredNotice } from './features/auth/SessionExpiredNotice';
import { RecoveryPage } from './features/auth/RecoveryPage';
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';
import { OnboardingForm } from './features/auth/OnboardingForm';
import { SignedInContent } from './features/auth/SignedInContent';
import { Notice, Busy } from './components/Notice';
import {LandingPage} from './features/landing/LandingPage';
import {applyPageMetadata} from './features/landing/metadata';
export default function App() {
 const [expired,setExpired]=useState(false),[dailyExpired,setDailyExpired]=useState(false);
 const [recovering,setRecovering]=useState(window.location.pathname==='/reset-password');
 const [session,setSession]=useState<Session|null>(null),[initial,setInitial]=useState(true),[register,setRegister]=useState(false),[dark,setDark]=useState(false),[user,setUser]=useState<UserContext|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[missing,setMissing]=useState(false),[revision,setRevision]=useState(0);
 useDailySession(session,()=>{setSession(null);setUser(null);setPending(false);setInitial(false);setMissing(false);setRecovering(false);setExpired(false);setRegister(false);setDailyExpired(true);navigateWorkspace('/',true);});
 const path=useWorkspacePath(Boolean(user),user?.role==='OWNER'?'/dashboard':user?.role==='ACCOUNTANT'?'/reports':'/pos');
 useEffect(()=>{applyPageMetadata(window.location.pathname);},[path,recovering]);
 useEffect(()=>{if(window.location.pathname==='/'&&new URLSearchParams(window.location.search).get('register')==='1')setRegister(true);},[]);
 useEffect(()=>{let alive=true;auth.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);if(error)setError(authMessage(error));setInitial(false);}});const {data}=auth.auth.onAuthStateChange((event,next)=>{if(event==='SIGNED_IN'&&next)setDailyExpired(false);if(event==='PASSWORD_RECOVERY'){window.history.replaceState(null,'','/reset-password');setRecovering(true);}setSession(next);setUser(current=>current&&current.userId===next?.user.id&&event!=='PASSWORD_RECOVERY'?current:null);});return()=>{alive=false;data.subscription.unsubscribe();};},[]);
 useEffect(()=>{setUser(null);setMissing(false);setExpired(false);setError('');setPending(false);if(!session||recovering)return;const controller=new AbortController();setPending(true);identityWithRefresh(session.access_token,session.user.id,controller.signal).then(context=>{if(controller.signal.aborted)return;if(window.location.pathname==='/')navigateWorkspace(context.role==='OWNER'?'/dashboard':context.role==='ACCOUNTANT'?'/reports':'/pos',true);setUser(context);}).catch(e=>{if(controller.signal.aborted)return;if(e instanceof SessionExpiredError)setExpired(true);else if(e instanceof RequestError && e.status===403)setMissing(true);else setError(authMessage(e));}).finally(()=>{if(!controller.signal.aborted)setPending(false);});return()=>controller.abort();},[session?.user.id,revision,recovering]);
 const title=initial||pending?'กำลังตรวจสอบบัญชี':user?(window.location.pathname==='/categories'?'หมวดหมู่สินค้า':'เข้าสู่ระบบสำเร็จ'):session?'ตรวจสอบร้านของคุณ':register?'สร้างร้านใหม่':'เข้าสู่ระบบ';
 if(window.location.pathname==='/'&&!recovering&&!session&&!user){
  const selectAuth=(event:React.MouseEvent<HTMLAnchorElement>,next:boolean)=>{event.preventDefault();setRegister(next);window.history.replaceState(null,'',next?'/?register=1#login':'/#login');requestAnimationFrame(()=>{document.getElementById('login')?.scrollIntoView({block:'start',behavior:'auto'});document.getElementById(next?'storeName':'email')?.focus({preventScroll:true});});};
  return <LandingPage dark={dark} onToggle={()=>setDark(!dark)} register={register} onRegister={event=>selectAuth(event,true)} onLogin={event=>selectAuth(event,false)} authContent={<>{dailyExpired?<Notice>หมดเวลาการใช้งานของวัน กรุณาเข้าสู่ระบบใหม่</Notice>:null}{!initial&&confirmationError?<Notice>{confirmationError}</Notice>:null}{register?<RegisterForm/>:<LoginForm disabled={initial}/>}</>}/>;
 }
 return <div data-theme={dark?'dark':'light'} className="app"><AppHeader dark={dark} onToggle={()=>setDark(!dark)} user={user} onSignOut={session?()=>{void signOutCurrentSession().catch(error=>{setError(authMessage(error));void import('./lib/alerts').then(m=>m.warningAlert(authMessage(error)));});}:undefined}/>{recovering||window.location.pathname==='/forgot-password'?<RecoveryPage reset={recovering} session={session} loading={initial} invalid={Boolean(confirmationError)}/>:<main>{window.location.pathname==='/join'?<JoinPage signedIn={Boolean(session)} loading={initial} onAccepted={()=>{navigateWorkspace('/',true);setRevision(v=>v+1);}}/>:<>{!session&&dailyExpired?<Notice>หมดเวลาการใช้งานของวัน กรุณาเข้าสู่ระบบใหม่</Notice>:null}{!user?<><h1>{title}</h1><p className="subtitle">{user?'บัญชีของคุณพร้อมใช้งาน':session?'ดำเนินการตั้งค่าร้านหรือเชื่อมต่ออีกครั้ง':register?'เริ่มต้นด้วยบัญชีเจ้าของร้าน':'จัดการร้านของคุณได้ในที่เดียว'}</p></>:null}{initial||pending?<div className="loading" role="status"><Busy/> กรุณารอสักครู่</div>:user?<SignedInContent user={user} path={path} onStoreNameChanged={name=>setUser(current=>current?.userId===user.userId&&current.orgId===user.orgId?{...current,orgName:name}:current)}/>:session?<>{expired?<SessionExpiredNotice/>:null}{missing?<OnboardingForm key={session.user.id} session={session} onComplete={()=>setRevision(v=>v+1)}/>:null}{error?<Notice>{error}</Notice>:null}{!expired?<button className="secondary retry" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18} aria-hidden="true"/>ตรวจสอบอีกครั้ง</button>:null}</>:register?<RegisterForm/>:<>{confirmationError?<Notice>{confirmationError}</Notice>:null}<LoginForm/></>}{!session?<p className="switch">{register?'มีบัญชีแล้ว?':'ยังไม่มีบัญชี?'} <button className="link" onClick={()=>setRegister(!register)}>{register?'เข้าสู่ระบบ':'สร้างร้านใหม่'}</button></p>:null}</>}</main>}<AppFooter/></div>;
}

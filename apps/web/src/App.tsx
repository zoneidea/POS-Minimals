import { JoinPage } from './features/management/JoinPage';
import { navigateWorkspace, useWorkspacePath } from './lib/use-workspace-path';
import { AppHeader } from './components/AppHeader';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, RefreshCw } from 'lucide-react';
import type { UserContext } from '../../../packages/contracts/src/index';
import { auth, authMessage, RequestError, confirmationError } from './lib/client';
import { identityWithRefresh, SessionExpiredError } from './lib/session-identity';
import { SessionExpiredNotice } from './features/auth/SessionExpiredNotice';
import { RecoveryPage } from './features/auth/RecoveryPage';
import { LoginForm } from './features/auth/LoginForm';
import { RegisterForm } from './features/auth/RegisterForm';
import { OnboardingForm } from './features/auth/OnboardingForm';
import { SignedInContent } from './features/auth/SignedInContent';
import { Notice, Busy } from './components/Notice';
export default function App() {
 const [expired,setExpired]=useState(false);
 const [recovering,setRecovering]=useState(window.location.pathname==='/reset-password');
 const [session,setSession]=useState<Session|null>(null),[initial,setInitial]=useState(true),[register,setRegister]=useState(false),[dark,setDark]=useState(false),[user,setUser]=useState<UserContext|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[missing,setMissing]=useState(false),[revision,setRevision]=useState(0);
 const path=useWorkspacePath(Boolean(user),user?.role==='OWNER'?'/dashboard':user?.role==='ACCOUNTANT'?'/reports':'/pos');
 useEffect(()=>{let alive=true;auth.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);if(error)setError(authMessage(error));setInitial(false);}});const {data}=auth.auth.onAuthStateChange((event,next)=>{if(event==='PASSWORD_RECOVERY'){window.history.replaceState(null,'','/reset-password');setRecovering(true);}setSession(next);setUser(current=>current&&current.userId===next?.user.id&&event!=='PASSWORD_RECOVERY'?current:null);});return()=>{alive=false;data.subscription.unsubscribe();};},[]);
 useEffect(()=>{setUser(null);setMissing(false);setExpired(false);setError('');setPending(false);if(!session||recovering)return;const controller=new AbortController();setPending(true);identityWithRefresh(session.access_token,session.user.id,controller.signal).then(context=>{if(controller.signal.aborted)return;if(window.location.pathname==='/')navigateWorkspace(context.role==='OWNER'?'/dashboard':context.role==='ACCOUNTANT'?'/reports':'/pos',true);setUser(context);}).catch(e=>{if(controller.signal.aborted)return;if(e instanceof SessionExpiredError)setExpired(true);else if(e instanceof RequestError && e.status===403)setMissing(true);else setError(authMessage(e));}).finally(()=>{if(!controller.signal.aborted)setPending(false);});return()=>controller.abort();},[session?.user.id,revision,recovering]);
 const title=initial||pending?'กำลังตรวจสอบบัญชี':user?(window.location.pathname==='/categories'?'หมวดหมู่สินค้า':'เข้าสู่ระบบสำเร็จ'):session?'ตรวจสอบร้านของคุณ':register?'สร้างร้านใหม่':'เข้าสู่ระบบ';
 return <div data-theme={dark?'dark':'light'} className="app"><AppHeader dark={dark} onToggle={()=>setDark(!dark)} user={user}/>{recovering||window.location.pathname==='/forgot-password'?<RecoveryPage reset={recovering} session={session} loading={initial} invalid={Boolean(confirmationError)}/>:<main>{window.location.pathname==='/join'?<JoinPage signedIn={Boolean(session)} loading={initial} onAccepted={()=>{navigateWorkspace('/',true);setRevision(v=>v+1);}}/>:<>{!user?<><h1>{title}</h1><p className="subtitle">{user?'บัญชีของคุณพร้อมใช้งาน':session?'ดำเนินการตั้งค่าร้านหรือเชื่อมต่ออีกครั้ง':register?'เริ่มต้นด้วยบัญชีเจ้าของร้าน':'จัดการร้านของคุณได้ในที่เดียว'}</p></>:null}{initial||pending?<div className="loading" role="status"><Busy/> กรุณารอสักครู่</div>:user?<SignedInContent user={user} path={path} onStoreNameChanged={name=>setUser(current=>current?.userId===user.userId&&current.orgId===user.orgId?{...current,orgName:name}:current)}/>:session?<>{expired?<SessionExpiredNotice/>:null}{missing?<OnboardingForm key={session.user.id} session={session} onComplete={()=>setRevision(v=>v+1)}/>:null}{error?<Notice>{error}</Notice>:null}{!expired?<button className="secondary retry" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18} aria-hidden="true"/>ตรวจสอบอีกครั้ง</button>:null}</>:register?<RegisterForm/>:<>{confirmationError?<Notice>{confirmationError}</Notice>:null}<LoginForm/></>}{session?user?null:<button className="secondary signout" onClick={async()=>{const {error}=await auth.auth.signOut();if(error)setError(authMessage(error));}}><LogOut size={18} aria-hidden="true"/>ออกจากระบบ</button>:<p className="switch">{register?'มีบัญชีแล้ว?':'ยังไม่มีบัญชี?'} <button className="link" onClick={()=>setRegister(!register)}>{register?'เข้าสู่ระบบ':'สร้างร้านใหม่'}</button></p>}</>}</main>}</div>;
}

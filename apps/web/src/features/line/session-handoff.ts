// Transfer only an already authenticated KidTang session in the same browser/origin.
// Supabase owns serialization, validation, token rotation and the shared-key lock.
type Session={access_token:string;refresh_token:string;user:{id:string}};
type Result={data:{session:Session|null};error:unknown};
export type HandoffAuth={getSession:()=>Promise<Result>;setSession:(tokens:{access_token:string;refresh_token:string})=>Promise<Result>;stopAutoRefresh:()=>Promise<void>;startAutoRefresh:()=>Promise<void>};
type Context={userId:string;orgId:string;expiresAt:string};
type Options={source:HandoffAuth;createTarget:()=>HandoffAuth;validate:(token:string)=>Promise<Context>;confirmSwitch:()=>Promise<boolean>;storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;keys:{privateKey:string;webKey:string;ssoKey:string};activeKey:string;userId:string;orgId:string;signal?:AbortSignal;now?:()=>number};
export async function handoffLineSession(o:Options):Promise<boolean>{
 const now=o.now??Date.now;
 const check=(s:Session|null,c:Context)=>{o.signal?.throwIfAborted();if(!s||s.user.id!==o.userId||c.userId!==o.userId||c.orgId!==o.orgId)throw new Error('บัญชีหรือร้านเปลี่ยน กรุณาตรวจสอบบัญชีก่อนเปิดระบบเว็บ');if(!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=now())throw new Error('หมดเวลาการใช้งานของวัน กรุณาเข้าสู่ระบบใหม่');};
 const initial=await o.source.getSession();if(initial.error||!initial.data.session)throw new Error('กรุณาเข้าสู่ระบบ KidTang อีกครั้ง');
 let session=initial.data.session,context=await o.validate(session.access_token);check(session,context);
 if(o.activeKey===o.keys.webKey)return true;
 // Preflight persistence before changing the Web session; the final marker is shorter.
 const preparing=`preparing:${crypto.randomUUID()}`;o.storage.setItem(o.keys.ssoKey,preparing);
 let target:HandoffAuth|undefined,stopped=false,activated=false;
 try{
  target=o.createTarget();const previous=await target.getSession();if(previous.error)throw new Error('ไม่สามารถตรวจสอบ session ของระบบเว็บได้');
  if(previous.data.session&&previous.data.session.user.id!==o.userId&&!await o.confirmSwitch())return false;
  check(session,context);await o.source.stopAutoRefresh();stopped=true;
  const latest=await o.source.getSession();if(latest.error||!latest.data.session)throw new Error('กรุณาเข้าสู่ระบบ KidTang อีกครั้ง');
  if(latest.data.session.access_token!==session.access_token){session=latest.data.session;context=await o.validate(session.access_token);}else session=latest.data.session;
  check(session,context);
  const installed=await target.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
  if(installed.error||installed.data.session?.user.id!==o.userId)throw new Error('ไม่สามารถเปิด session ของระบบเว็บได้ กรุณาลองใหม่');
  check(installed.data.session,context);o.storage.setItem(o.keys.ssoKey,'web');activated=true;
  // No signOut here: it would revoke the very session being transferred.
  try{o.storage.removeItem(o.keys.privateKey);}catch{/* The marker makes the old key inactive; next initialization cleans it. */}
  return true;
 }finally{
  await target?.stopAutoRefresh();
  if(!activated){try{if(o.storage.getItem(o.keys.ssoKey)===preparing)o.storage.removeItem(o.keys.ssoKey);}catch{/* No credential or payload is logged. */}if(stopped)await o.source.startAutoRefresh();}
 }
}

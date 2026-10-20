import {BrandLogo} from '../../components/BrandLogo';
import {successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useEffect, useState } from 'react';
import { MailCheck, Send, ShieldCheck } from 'lucide-react';
import { auth, authMessage } from '../../lib/client';
import { Busy, Notice } from '../../components/Notice';
export function VerificationNotice({ email }: { email: string }) {
 const [seconds,setSeconds]=useState(60),[busy,setBusy]=useState(false),[error,setError]=useActionError(),[resent,setResent]=useState(false);
 useEffect(()=>{if(seconds<=0)return;const timer=window.setTimeout(()=>setSeconds(v=>v-1),1000);return()=>clearTimeout(timer);},[seconds]);
 return <section className="verification" aria-labelledby="verification-title"><div className="verification-icon"><MailCheck size={32} aria-hidden="true"/></div><div className="verification-brand"><BrandLogo/></div><h2 id="verification-title">ตรวจสอบอีเมลของคุณ</h2><p>ส่งขั้นตอนยืนยันอีเมลไปที่</p><strong className="verification-email">{email}</strong><p>เปิดอีเมลจาก POSJung แล้วกดปุ่ม <strong>Confirm email</strong> เพื่อยืนยันบัญชีและสร้างร้านให้เสร็จ</p><div className="verification-tip"><ShieldCheck size={20} aria-hidden="true"/><span>หากไม่พบอีเมล ลองตรวจสอบโฟลเดอร์สแปมหรือจดหมายขยะ</span></div>{error?<Notice>{error}</Notice>:null}{resent?<Notice success>ขอส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบกล่องจดหมาย</Notice>:null}<button type="button" className="secondary retry" disabled={busy||seconds>0} onClick={async()=>{setBusy(true);setError('');setResent(false);try{const {error}=await auth.auth.resend({type:'signup',email,options:{emailRedirectTo:window.location.origin}});if(error)throw error;await successAlert('ส่งคำขอยืนยันอีเมลแล้ว');setResent(true);setSeconds(60);}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>{busy?<Busy/>:<Send size={18} aria-hidden="true"/>}{seconds>0?`ส่งอีเมลอีกครั้งใน ${seconds} วินาที`:'ส่งอีเมลยืนยันอีกครั้ง'}</button></section>;
}

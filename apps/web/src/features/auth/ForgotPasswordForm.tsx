import {successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { sendPasswordReset } from './password-recovery';
export function ForgotPasswordForm() {
 const [busy,setBusy]=useState(false),[error,setError]=useActionError(),[sent,setSent]=useState(false);
 if(sent)return <Notice success>หากมีบัญชีสำหรับอีเมลนี้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์สแปม</Notice>;
 return <form onSubmit={async e=>{e.preventDefault();const v=new FormData(e.currentTarget);setBusy(true);setError('');try{await sendPasswordReset(String(v.get('email')),window.location.origin);await successAlert('ส่งคำขอตั้งรหัสผ่านใหม่แล้ว');setSent(true);}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}><Field id="recovery-email" name="email" label="อีเมล" icon={Mail} type="email" autoComplete="email" placeholder="example@domain.com" required disabled={busy}/>{error?<Notice>{error}</Notice>:null}<button className="primary" disabled={busy}>{busy?<Busy/>:<Send size={20} aria-hidden="true"/>}ส่งลิงก์ตั้งรหัสผ่านใหม่</button></form>;
}

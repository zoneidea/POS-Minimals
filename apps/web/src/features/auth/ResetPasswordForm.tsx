import {confirmAlert,successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { auth, authMessage } from '../../lib/client';
import { changeRecoveredPassword, newPasswordSchema } from './password-recovery';
export function ResetPasswordForm({ onComplete }: { onComplete: () => void }) {
 const [busy,setBusy]=useState(false),[error,setError]=useActionError();
 return <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,v=new FormData(form),input={password:String(v.get('password')),confirm:String(v.get('confirm'))};setError('');const valid=newPasswordSchema.safeParse(input);if(!valid.success){setError(valid.error.issues[0]!.message);return;}if(!await confirmAlert('ยืนยันการเปลี่ยนรหัสผ่านหรือไม่?'))return;setBusy(true);try{await changeRecoveredPassword(input);form.reset();await auth.auth.signOut({scope:'local'});await successAlert('เปลี่ยนรหัสผ่านสำเร็จ');onComplete();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}><Field label="รหัสผ่านใหม่" icon={LockKeyhole} id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/><p className="hint">ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร</p><Field label="ยืนยันรหัสผ่านใหม่" icon={LockKeyhole} id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/>{error?<Notice>{error}</Notice>:null}<button className="primary" disabled={busy}>{busy?<Busy/>:<ShieldCheck size={20} aria-hidden="true"/>}บันทึกรหัสผ่านใหม่</button></form>;
}

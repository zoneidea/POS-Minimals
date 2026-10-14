import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { Mail, LockKeyhole, LogIn } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { auth, authMessage } from '../../lib/client';
export function LoginForm() {
 const [busy,setBusy]=useState(false), [error,setError]=useActionError();
 return <form onSubmit={async e => {e.preventDefault();const values=new FormData(e.currentTarget);setBusy(true);setError('');try {const {error}=await auth.auth.signInWithPassword({email:String(values.get('email')).trim(),password:String(values.get('password'))});if(error) throw error;} catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>
 <Field label="อีเมล" icon={Mail} id="email" name="email" type="email" autoComplete="email" placeholder="example@domain.com" required disabled={busy}/><Field label="รหัสผ่าน" icon={LockKeyhole} id="password" name="password" type="password" autoComplete="current-password" required disabled={busy}/>{error ? <Notice>{error}</Notice> : null}<button className="primary" disabled={busy}>{busy ? <Busy/> : <LogIn size={20} aria-hidden="true"/>}เข้าสู่ระบบ</button><a className="forgot-link" href="/forgot-password">ลืมรหัสผ่าน?</a></form>;
}

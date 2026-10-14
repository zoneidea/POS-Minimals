import {successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { contactEmailSchema, contactPhoneSchema } from '@pos/contracts';
import { Store, Phone, UserRound, Mail, LockKeyhole, UserRoundPlus } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { VerificationNotice } from './VerificationNotice';
import { auth, authMessage } from '../../lib/client';
export function RegisterForm() {
 const [busy,setBusy]=useState(false),[error,setError]=useActionError(),[sent,setSent]=useState('');
 if(sent) return <VerificationNotice email={sent}/>;
 return <form onSubmit={async e=>{e.preventDefault();const v=new FormData(e.currentTarget);setError('');if(!contactEmailSchema.safeParse(v.get('email')).success){setError('กรุณากรอกอีเมลให้ถูกต้อง');return;}if(!contactPhoneSchema.safeParse(v.get('phone')).success){setError('กรุณากรอกเบอร์โทร 9–10 หลัก เริ่มต้นด้วย 0');return;}if(v.get('password')!==v.get('confirm')){setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');return;}setBusy(true);try{const {data,error}=await auth.auth.signUp({email:String(v.get('email')).trim(),password:String(v.get('password')),options:{emailRedirectTo:window.location.origin,data:{store_phone:String(v.get('phone')).trim(),store_name:String(v.get('storeName')).trim(),display_username:String(v.get('displayUsername')).trim()}}});if(error)throw error;await successAlert('สร้างบัญชีสำเร็จ');if(!data.session)setSent(String(v.get('email')).trim());}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>
 <Field label="ชื่อร้าน" icon={Store} id="storeName" name="storeName" maxLength={120} required disabled={busy}/><Field label="ชื่อแสดงผล" icon={UserRound} id="displayUsername" name="displayUsername" maxLength={80} required disabled={busy}/><Field label="อีเมล" icon={Mail} id="email" name="email" type="email" autoComplete="email" required disabled={busy}/><Field label="เบอร์โทร" icon={Phone} id="phone" name="phone" type="tel" autoComplete="tel" maxLength={10} pattern="0[0-9]{8,9}" title="เบอร์โทร 9–10 หลัก เริ่มต้นด้วย 0" required disabled={busy}/><Field label="รหัสผ่าน" icon={LockKeyhole} id="password" name="password" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/><p className="hint">ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร</p><Field label="ยืนยันรหัสผ่าน" icon={LockKeyhole} id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/>{error ? <Notice>{error}</Notice>:null}<button className="primary" disabled={busy}>{busy?<Busy/>:<UserRoundPlus size={20} aria-hidden="true"/>}สร้างบัญชี</button></form>;
}

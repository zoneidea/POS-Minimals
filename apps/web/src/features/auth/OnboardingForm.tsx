import { useState } from 'react';
import { contactEmailSchema, contactPhoneSchema } from '@pos/contracts';
import type { Session } from '@supabase/supabase-js';
import { Store, Phone, Mail, UserRound, Check } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { request, authMessage } from '../../lib/client';
export function OnboardingForm({session,onComplete}:{session:Session;onComplete:()=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();const v=new FormData(e.currentTarget);setError('');if(!contactEmailSchema.safeParse(session.user.email).success||!contactPhoneSchema.safeParse(v.get('phone')).success){setError('กรุณาตรวจสอบอีเมลและเบอร์โทรให้ถูกต้อง');return;}setBusy(true);try{await request('/orgs/bootstrap',session.access_token,{storeName:String(v.get('storeName')).trim(),displayUsername:String(v.get('displayUsername')).trim(),phone:String(v.get('phone')).trim()});onComplete();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>
 <p className="hint">หากบัญชีนี้ยังไม่มีร้าน สามารถสร้างร้านได้ที่นี่ บัญชีที่ถูกระงับต้องติดต่อเจ้าของร้าน</p><Field label="ชื่อร้าน" icon={Store} id="storeName" name="storeName" defaultValue={session.user.user_metadata.store_name ?? ''} maxLength={120} required disabled={busy}/><Field label="ชื่อแสดงผล" icon={UserRound} id="displayUsername" name="displayUsername" defaultValue={session.user.user_metadata.display_username ?? ''} maxLength={80} required disabled={busy}/><Field label="อีเมลบัญชี" icon={Mail} id="email" name="email" type="email" value={session.user.email ?? ''} readOnly required/><Field label="เบอร์โทร" icon={Phone} id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={session.user.user_metadata.store_phone ?? ''} maxLength={16} pattern="(?:0[0-9]{8,9}|\+[1-9][0-9]{7,14})" title="เบอร์โทร 9–10 หลัก หรือ +66812345678" required disabled={busy}/>{error?<Notice>{error}</Notice>:null}<button className="primary" disabled={busy}>{busy?<Busy/>:<Check size={20} aria-hidden="true"/>}สร้างร้านให้เสร็จ</button></form>;
}

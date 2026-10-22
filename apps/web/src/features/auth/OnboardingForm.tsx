import type {StoreMode} from '../store-mode/StoreModeSelect';
import {StoreModeButtons} from '../store-mode/StoreModeButtons';
import {warningAlert,successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { contactEmailSchema, contactPhoneSchema } from '@pos/contracts';
import type { Session } from '@supabase/supabase-js';
import { Store, Phone, Mail, UserRound, Check } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { request, authMessage } from '../../lib/client';
export function OnboardingForm({session,onComplete}:{session:Session;onComplete:()=>void}) {
 const [mode,setMode]=useState<StoreMode>('RETAIL');
 const [busy,setBusy]=useState(false),[error,setError]=useActionError(),[created,setCreated]=useState(false);
 if(created)return <section><Notice success>สร้างร้านสำเร็จแล้ว</Notice><Notice>ยังยืนยันการส่งข้อมูลร้านไป ReservePay ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อก่อนส่งซ้ำ</Notice><button className="primary" onClick={onComplete}>เข้าสู่ร้าน</button></section>;
 return <form onSubmit={async e=>{e.preventDefault();const v=new FormData(e.currentTarget);setError('');if(!contactEmailSchema.safeParse(session.user.email).success||!contactPhoneSchema.safeParse(v.get('phone')).success){setError('กรุณาตรวจสอบอีเมลและเบอร์โทรให้ถูกต้อง');return;}setBusy(true);try{const result=await request('/orgs/bootstrap',session.access_token,{storeMode:mode,storeName:String(v.get('storeName')).trim(),displayUsername:String(v.get('displayUsername')).trim(),phone:String(v.get('phone')).trim()}) as {reservePayStatus?:string};if(result.reservePayStatus&&result.reservePayStatus!=='SENT'){setCreated(true);await warningAlert('สร้างร้านแล้ว แต่ยังยืนยันการส่งข้อมูลไป ReservePay ไม่สำเร็จ');}else{await successAlert('สร้างร้านสำเร็จ');onComplete();}}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>
 <p className="hint">หากบัญชีนี้ยังไม่มีร้าน สามารถสร้างร้านได้ที่นี่ บัญชีที่ถูกระงับต้องติดต่อเจ้าของร้าน</p><Field label="ชื่อร้าน" icon={Store} id="storeName" name="storeName" defaultValue={session.user.user_metadata.store_name ?? ''} maxLength={120} required disabled={busy}/><Field label="ชื่อแสดงผล" icon={UserRound} id="displayUsername" name="displayUsername" defaultValue={session.user.user_metadata.display_username ?? ''} maxLength={80} required disabled={busy}/><Field label="อีเมลบัญชี" icon={Mail} id="email" name="email" type="email" value={session.user.email ?? ''} readOnly required/><Field label="เบอร์โทร" icon={Phone} id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={session.user.user_metadata.store_phone ?? ''} maxLength={10} pattern="0[0-9]{8,9}" title="เบอร์โทร 9–10 หลัก เริ่มต้นด้วย 0" required disabled={busy}/><StoreModeButtons onboarding value={mode} onChange={setMode} disabled={busy}/>{error?<Notice>{error}</Notice>:null}<button className="primary" disabled={busy}>{busy?<Busy/>:<Check size={20} aria-hidden="true"/>}สร้างร้านให้เสร็จ</button></form>;
}

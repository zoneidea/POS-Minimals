import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Store, UserRound, Check } from 'lucide-react';
import { Field } from '../../components/Field';
import { Notice, Busy } from '../../components/Notice';
import { request, authMessage } from '../../lib/client';
export function OnboardingForm({session,onComplete}:{session:Session;onComplete:()=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();const v=new FormData(e.currentTarget);setBusy(true);setError('');try{await request('/orgs/bootstrap',session.access_token,{storeName:String(v.get('storeName')).trim(),displayUsername:String(v.get('displayUsername')).trim()});onComplete();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>
 <p className="hint">หากบัญชีนี้ยังไม่มีร้าน สามารถสร้างร้านได้ที่นี่ บัญชีที่ถูกระงับต้องติดต่อเจ้าของร้าน</p><Field label="ชื่อร้าน" icon={Store} id="storeName" name="storeName" defaultValue={session.user.user_metadata.store_name ?? ''} maxLength={120} required disabled={busy}/><Field label="ชื่อแสดงผล" icon={UserRound} id="displayUsername" name="displayUsername" defaultValue={session.user.user_metadata.display_username ?? ''} maxLength={80} required disabled={busy}/>{error?<Notice>{error}</Notice>:null}<button className="primary" disabled={busy}>{busy?<Busy/>:<Check size={20} aria-hidden="true"/>}สร้างร้านให้เสร็จ</button></form>;
}

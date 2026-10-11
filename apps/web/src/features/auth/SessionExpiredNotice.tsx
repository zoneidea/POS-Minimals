import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { auth, authMessage } from '../../lib/client';
import { Notice, Busy } from '../../components/Notice';
export function SessionExpiredNotice() {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <><Notice>เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง</Notice>{error?<Notice>{error}</Notice>:null}<button className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const {error}=await auth.auth.signOut({scope:'local'});if(error)throw error;}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>{busy?<Busy/>:<LogIn size={20} aria-hidden="true"/>}กลับไปเข้าสู่ระบบ</button></>;
}

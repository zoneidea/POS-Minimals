import {LabelText} from '../../components/LabelText';
import {confirmAlert,successAlert} from '../../lib/alerts';
import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Notice,Busy } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { call } from './client';
export function InviteModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){const [busy,setBusy]=useState(false),[error,setError]=useActionError();return <Modal title="เชิญสมาชิก" busy={busy} onClose={onClose}><form className="settings-form" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError('');try{await call('/users/invitations',{email:String(data.get('email')).trim(),role:String(data.get('role'))},'POST');await successAlert('ส่งคำเชิญสำเร็จ');onSaved();}catch(error){setError(authMessage(error));}finally{setBusy(false);}}}><label><LabelText required>อีเมล</LabelText><input name="email" type="email" maxLength={254} required disabled={busy}/></label><label>สิทธิ์<select name="role" disabled={busy}><option value="EMPLOYEE">พนักงานขาย</option><option value="ACCOUNTANT">บัญชี</option></select></label><p>ผู้รับจะได้รับอีเมลเชิญและตั้งรหัสผ่านด้วยตนเอง</p>{error?<Notice>{error}</Notice>:null}<div className="category-actions"><button className="primary" disabled={busy}>{busy?<Busy/>:null}ส่งคำเชิญ</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>ยกเลิก</button></div></form></Modal>;}

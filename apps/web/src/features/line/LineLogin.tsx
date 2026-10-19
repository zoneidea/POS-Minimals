import {useState} from 'react';
import {LoginFields} from '../auth/LoginFields';
import {lineAuth,lineMessage} from './api';
import {recordLineEvent} from './diagnostics';
export function LineLogin(){const [busy,setBusy]=useState(false),[error,setError]=useState('');return <section className="line-login"><h1>เข้าสู่ระบบร้านของคุณ</h1><p>ใช้บัญชี KidTang เดิมเพื่อเริ่มขายสินค้า</p><form onSubmit={async event=>{event.preventDefault();if(busy)return;const values=new FormData(event.currentTarget);setBusy(true);setError('');try{const result=await lineAuth.auth.signInWithPassword({email:String(values.get('email')).trim(),password:String(values.get('password'))});if(result.error)throw result.error;recordLineEvent({event:'LOGIN_SUCCESS'});}catch(e){setError(lineMessage(e));}finally{setBusy(false);}}}>{error?<p role="alert" className="line-notice">{error}</p>:null}<LoginFields busy={busy}/></form><small>บัญชี LINE ยังไม่ได้ผูกเข้ากับบัญชีร้านโดยอัตโนมัติ</small></section>;}

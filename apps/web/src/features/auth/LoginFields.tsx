import {Mail,LockKeyhole,LogIn} from 'lucide-react';
import {Field} from '../../components/Field';
import {Busy} from '../../components/Notice';
export function LoginFields({busy=false,preparing=false}:{busy?:boolean;preparing?:boolean}){
 return <><Field label="อีเมล" icon={Mail} id="email" name="email" type="email" autoComplete="email" placeholder="example@domain.com" required disabled={busy||preparing}/><Field label="รหัสผ่าน" icon={LockKeyhole} id="password" name="password" type="password" autoComplete="current-password" required disabled={busy||preparing}/><button className="primary" disabled={busy||preparing}>{busy?<Busy/>:<LogIn size={20} aria-hidden="true"/>}{preparing?'กำลังเตรียมเข้าสู่ระบบ':'เข้าสู่ระบบ'}</button><a className="forgot-link" href="/forgot-password">ลืมรหัสผ่าน?</a></>;
}

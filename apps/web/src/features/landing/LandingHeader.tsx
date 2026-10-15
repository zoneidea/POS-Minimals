import {Hexagon,Moon,Sun} from 'lucide-react';
import type {MouseEventHandler} from 'react';
export function LandingHeader({dark=false,onToggle,onLogin}:{dark?:boolean;onToggle?:()=>void;onLogin?:MouseEventHandler<HTMLAnchorElement>}){
 return <header className="landing-header"><div className="landing-container landing-header-inner"><a className="landing-brand" href="/" aria-label="POS Minimal หน้าแรก"><span><Hexagon size={25} aria-hidden="true"/></span>POS Minimal</a><nav aria-label="เมนูหน้าแรก"><a href="#features">ฟีเจอร์</a><a href="#pricing">ค่าธรรมเนียม</a><a href="#faq">คำถามที่พบบ่อย</a></nav><div className="landing-header-actions"><button type="button" className="landing-theme" onClick={onToggle} aria-label={dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด'}>{dark?<Sun size={20}/>:<Moon size={20}/>}</button><a className="landing-login-link" href="#login" onClick={onLogin}>เข้าสู่ระบบ</a></div></div></header>;
}

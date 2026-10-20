import {version} from '../../../../package.json';
import './app-header.css';
import {BrandLogo} from './BrandLogo';
import { Moon,Sun } from 'lucide-react';
import type { UserContext } from '../../../../packages/contracts/src/index';
export function AppHeader({dark,onToggle,user}:{dark:boolean;onToggle:()=>void;user:UserContext|null}){
 return <header className="app-header"><div className="header-brand"><a className="brand" href="/" aria-label="POSJung หน้าแรก"><BrandLogo/></a><span className="app-version" title="เวอร์ชันระบบ">v{version}</span></div><div className="header-actions">{user?<div className="header-account"><span className="user-avatar" aria-hidden="true">{user.username.slice(0,1)}</span><div><strong>{user.orgName}</strong><span>{user.username} · {({OWNER:'เจ้าของร้าน',EMPLOYEE:'พนักงาน',ACCOUNTANT:'บัญชี'})[user.role]}</span></div></div>:null}<button className="secondary theme-toggle" onClick={onToggle} aria-label={dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด'} title={dark?'โหมดสว่าง':'โหมดมืด'}>{dark?<Sun size={20}/>:<Moon size={20}/>}</button></div></header>;
}

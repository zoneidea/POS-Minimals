import { PosPage } from '../pos/PosPage';
import { AuditPage } from '../audits/AuditPage';
import { ProductsPage } from '../products/ProductsPage';
import { LogOut, LayoutDashboard, ShoppingCart, Package, Tags, Settings, Users, ChartColumn, History, UserRound } from 'lucide-react';
import type { UserContext } from '../../../../../packages/contracts/src/index';
import { Account } from './Account';
import { CategoriesPage } from '../categories/CategoriesPage';
import { useState } from 'react';
import { auth, authMessage } from '../../lib/client';
import { Notice } from '../../components/Notice';
const menus=[
 {path:'/dashboard',label:'Dashboard',icon:LayoutDashboard,permission:'dashboard:read'},
 {path:'/pos',label:'ขายสินค้า',icon:ShoppingCart,permission:'pos:read'},
 {path:'/inventory',label:'คลังสินค้า',icon:Package,permission:'inventory:manage'},
 {path:'/categories',label:'หมวดหมู่สินค้า',icon:Tags,permission:'categories:manage'},
 {path:'/settings',label:'ตั้งค่าร้าน',icon:Settings,permission:'settings:manage'},
 {path:'/users',label:'ผู้ใช้และสิทธิ์',icon:Users,permission:'users:manage'},
 {path:'/reports',label:'รายงาน',icon:ChartColumn,permission:'reports:read'},
 {path:'/audits',label:'ประวัติกิจกรรม',icon:History,permission:'audit:manage'},
 {path:'/account',label:'บัญชีร้าน',icon:UserRound,permission:null},
];
export function SignedInContent({user,path}:{user:UserContext;path:string}){
 const [error,setError]=useState('');
 const menu=menus.find(item=>item.path===path),allowed=menu&&(!menu.permission||user.permissions.includes(menu.permission));
 return <div className="workspace"><nav className="sidebar" aria-label="เมนูหลัก">{menus.filter(item=>!item.permission||user.permissions.includes(item.permission)).map(({path:href,label,icon:Icon})=><a key={href} href={href} title={label} aria-label={label} aria-current={path===href?'page':undefined}><Icon size={24} aria-hidden="true"/><span className="menu-tooltip">{label}</span></a>)}<button title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={async()=>{const {error}=await auth.auth.signOut();if(error)setError(authMessage(error));}}><LogOut size={24} aria-hidden="true"/><span className="menu-tooltip">ออกจากระบบ</span></button></nav><section className="workspace-content"><>{error?<Notice>{error}</Notice>:null}</><h1>{menu?<menu.icon size={28} aria-hidden="true"/>:null}{menu?.label??'ไม่พบหน้า'}</h1>{!allowed?<Notice>ไม่มีสิทธิ์เข้าถึงหน้านี้</Notice>:path==='/categories'?<CategoriesPage key={`${user.userId}:${user.orgId}`}/>:path==='/inventory'?<ProductsPage key={`${user.userId}:${user.orgId}`}/>:path==='/pos'?<PosPage key={`${user.userId}:${user.orgId}`}/>:path==='/audits'?<AuditPage key={`${user.userId}:${user.orgId}`}/>:path==='/account'?<Account user={user}/>:<div className="module-pending"><menu.icon size={40} aria-hidden="true"/><p>ส่วนนี้อยู่ระหว่างพัฒนา</p></div>}</section></div>;
}

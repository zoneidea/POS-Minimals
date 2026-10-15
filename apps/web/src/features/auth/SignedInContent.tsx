const GatewayReportPage=lazy(()=>import('../reports/GatewayReportPage').then(module=>({default:module.GatewayReportPage})));
import { lazy,Suspense,useState } from 'react';
import { PageLoadBoundary } from '../../components/PageLoadBoundary';
const ReportsPage=lazy(()=>import('../reports/ReportsPage').then(module=>({default:module.ReportsPage})));
const DashboardPage=lazy(()=>import('../reports/DashboardPage').then(module=>({default:module.DashboardPage})));
const SettingsPage=lazy(()=>import('../management/SettingsPage').then(module=>({default:module.SettingsPage})));
const StaffPage=lazy(()=>import('../management/StaffPage').then(module=>({default:module.StaffPage})));
const SalesPage=lazy(()=>import('../sales/SalesPage').then(module=>({default:module.SalesPage})));
const PosPage=lazy(()=>import('../pos/PosPage').then(module=>({default:module.PosPage})));
const AuditPage=lazy(()=>import('../audits/AuditPage').then(module=>({default:module.AuditPage})));
const ProductsPage=lazy(()=>import('../products/ProductsPage').then(module=>({default:module.ProductsPage})));
import { ReceiptText, LogOut, LayoutDashboard, ShoppingCart, Package, Tags, Settings, Users, ChartColumn, History, UserRound } from 'lucide-react';
import type { UserContext } from '../../../../../packages/contracts/src/index';
const Account=lazy(()=>import('./Account').then(module=>({default:module.Account})));
const CategoriesPage=lazy(()=>import('../categories/CategoriesPage').then(module=>({default:module.CategoriesPage})));
import { auth, authMessage,signOutCurrentSession } from '../../lib/client';
import { Notice } from '../../components/Notice';
const menus=[
 {path:'/dashboard',label:'Dashboard',icon:LayoutDashboard,permission:'dashboard:read'},
 {path:'/pos',label:'ขายสินค้า',icon:ShoppingCart,permission:'pos:read'},
 {path:'/sales',label:'รายการขาย',icon:ReceiptText,permission:'sales:read'},
 {path:'/inventory',label:'คลังสินค้า',icon:Package,permission:'inventory:manage'},
 {path:'/categories',label:'หมวดหมู่สินค้า',icon:Tags,permission:'categories:manage'},
 {path:'/reports/gateway',label:'รายงาน Payment Gateway',icon:ChartColumn,permission:'reports:read'},
 {path:'/reports',label:'รายงาน',icon:ChartColumn,permission:'reports:read'},
 {path:'/audits',label:'ประวัติกิจกรรม',icon:History,permission:'audit:manage'},
 {path:'/account',label:'บัญชีร้าน',icon:UserRound,permission:null},
 {path:'/settings',label:'ตั้งค่าร้าน',icon:Settings,permission:'settings:view'},
 {path:'/users',label:'ผู้ใช้และสิทธิ์',icon:Users,permission:'users:manage'},
];
export function SignedInContent({user,path,onStoreNameChanged}:{user:UserContext;path:string;onStoreNameChanged:(name:string)=>void}){
 const [error,setError]=useState('');
 const menu=menus.find(item=>item.path===path),allowed=menu&&(!menu.permission||user.permissions.includes(menu.permission)||(menu.path==='/settings'&&user.role==='OWNER'));
 return <div className="workspace"><nav className="sidebar" aria-label="เมนูหลัก">{menus.filter(item=>item.path!=='/account'&&item.path!=='/reports/gateway'&&(!item.permission||user.permissions.includes(item.permission)||(item.path==='/settings'&&user.role==='OWNER'))).map(({path:href,label,icon:Icon})=><a key={href} href={href} title={label} aria-label={label} aria-current={path===href||(href==='/reports'&&path.startsWith('/reports/'))?'page':undefined}><Icon size={24} aria-hidden="true"/><span className="menu-label">{label}</span></a>)}<button title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={async()=>{try{await signOutCurrentSession();}catch(error){setError(authMessage(error));}}}><LogOut size={24} aria-hidden="true"/><span className="menu-label">ออกจากระบบ</span></button></nav><section className={`workspace-content${path==='/dashboard'?' dashboard-content':''}`}><>{error?<Notice>{error}</Notice>:null}</><h1>{menu?<menu.icon size={28} aria-hidden="true"/>:null}{menu?.label??'ไม่พบหน้า'}</h1><PageLoadBoundary key={`${user.userId}:${user.orgId}:${path}`}><Suspense fallback={<p role="status">กำลังโหลดหน้า</p>}>{!allowed?<Notice>ไม่มีสิทธิ์เข้าถึงหน้านี้</Notice>:path==='/dashboard'?<DashboardPage key={`${user.userId}:${user.orgId}`}/>:path==='/reports/gateway'?<GatewayReportPage key={`${user.userId}:${user.orgId}`}/>:path==='/reports'?<ReportsPage key={`${user.userId}:${user.orgId}`}/>:path==='/settings'?<SettingsPage readOnly={user.role==='ACCOUNTANT'} onStoreNameChanged={onStoreNameChanged} key={`${user.userId}:${user.orgId}`}/>:path==='/users'?<StaffPage key={`${user.userId}:${user.orgId}`}/>:path==='/sales'?<SalesPage canVoid={user.permissions.includes('sales:void')} key={`${user.userId}:${user.orgId}`}/>:path==='/categories'?<CategoriesPage key={`${user.userId}:${user.orgId}`}/>:path==='/inventory'?<ProductsPage key={`${user.userId}:${user.orgId}`}/>:path==='/pos'?<PosPage userId={user.userId} orgId={user.orgId} key={`${user.userId}:${user.orgId}`}/>:path==='/audits'?<AuditPage key={`${user.userId}:${user.orgId}`}/>:path==='/account'?<Account user={user}/>:<div className="module-pending"><menu.icon size={40} aria-hidden="true"/><p>ส่วนนี้อยู่ระหว่างพัฒนา</p></div>}</Suspense></PageLoadBoundary></section></div>;
}

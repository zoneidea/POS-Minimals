import {WorkspaceSidebar} from '../../components/WorkspaceSidebar';
import {ModuleAccessProvider,useModuleAccess} from '../marketplace/ModuleAccess';
const CouponsPage=lazy(()=>import('../coupons/CouponsPage').then(m=>({default:m.CouponsPage})));
const CouponReportPage=lazy(()=>import('../coupons/CouponReportPage').then(m=>({default:m.CouponReportPage})));
const MarketplacePage=lazy(()=>import('../marketplace/MarketplacePage').then(module=>({default:module.MarketplacePage})));
const GatewayReportPage=lazy(()=>import('../reports/GatewayReportPage').then(module=>({default:module.GatewayReportPage})));
import { lazy,Suspense,useState } from 'react';
import { PageLoadBoundary } from '../../components/PageLoadBoundary';
const ReportsPage=lazy(()=>import('../reports/ReportsPage').then(module=>({default:module.ReportsPage})));
const DashboardPage=lazy(()=>import('../reports/DashboardPage').then(module=>({default:module.DashboardPage})));
const SettingsPage=lazy(()=>import('../management/SettingsPage').then(module=>({default:module.SettingsPage})));
const StaffPage=lazy(()=>import('../management/StaffPage').then(module=>({default:module.StaffPage})));
const SalesPage=lazy(()=>import('../sales/SalesPage').then(module=>({default:module.SalesPage})));
const PosPage=lazy(()=>import('../restaurant/PosEntry').then(module=>({default:module.PosEntry})));
const AuditPage=lazy(()=>import('../audits/AuditPage').then(module=>({default:module.AuditPage})));
const ProductsPage=lazy(()=>import('../products/ProductsPage').then(module=>({default:module.ProductsPage})));
import { ReceiptText, LayoutDashboard, ShoppingCart, Package, Tags, Settings, Users, ChartColumn, History, UserRound, Store, TicketPercent } from 'lucide-react';
import type { UserContext } from '../../../../../packages/contracts/src/index';
const Account=lazy(()=>import('./Account').then(module=>({default:module.Account})));
const CategoriesPage=lazy(()=>import('../categories/CategoriesPage').then(module=>({default:module.CategoriesPage})));
import { Notice } from '../../components/Notice';
const menus=[
 {path:'/dashboard',label:'Dashboard',icon:LayoutDashboard,permission:'dashboard:read'},
 {path:'/pos',label:'ขายสินค้า',icon:ShoppingCart,permission:'pos:read'},
 {path:'/sales',label:'รายการขาย',icon:ReceiptText,permission:'sales:read'},
 {path:'/inventory',label:'สินค้า',icon:Package,permission:'inventory:manage'},
 {path:'/categories',label:'หมวดหมู่สินค้า',icon:Tags,permission:'categories:manage'},
 {path:'/reports/gateway',label:'รายงาน Payment Gateway',icon:ChartColumn,permission:'reports:read'},
 {path:'/reports',label:'รายงาน',icon:ChartColumn,permission:'reports:read'},
 {path:'/audits',label:'ประวัติกิจกรรม',icon:History,permission:'audit:manage'},
 {path:'/coupons',label:'คูปอง/ส่วนลด',icon:TicketPercent,permission:null},
 {path:'/reports/coupons',label:'รายงานการใช้คูปอง',icon:TicketPercent,permission:'reports:read'},
 {path:'/marketplace',label:'Marketplace',icon:Store,permission:null},
 {path:'/account',label:'บัญชีร้าน',icon:UserRound,permission:null},
 {path:'/settings',label:'ตั้งค่าร้าน',icon:Settings,permission:'settings:view'},
 {path:'/users',label:'ผู้ใช้และสิทธิ์',icon:Users,permission:'users:manage'},
];
export function SignedInContent(props:{user:UserContext;path:string;onStoreNameChanged:(name:string)=>void}){return <ModuleAccessProvider key={`${props.user.userId}:${props.user.orgId}`}><WorkspaceContent {...props}/></ModuleAccessProvider>;}
function WorkspaceContent({user,path,onStoreNameChanged}:{user:UserContext;path:string;onStoreNameChanged:(name:string)=>void}){
 const access=useModuleAccess();
 const moduleAllowed=(route:string)=>route==='/coupons'?access.coupons&&user.role==='OWNER':route==='/reports/coupons'?access.coupons:true;
 const [collapsed,setCollapsed]=useState(()=>{try{return typeof window!=='undefined'&&localStorage.getItem('kidtang:sidebar-collapsed')==='true';}catch{return false;}});
 const toggleSidebar=()=>{const next=!collapsed;setCollapsed(next);try{localStorage.setItem('kidtang:sidebar-collapsed',String(next));}catch{/* UI still works when browser storage is unavailable. */}};
 const menu=menus.find(item=>item.path===path),allowed=menu&&moduleAllowed(path)&&(menu.path!=='/marketplace'||user.role==='OWNER')&&(menu.path!=='/users'||user.role==='OWNER')&&(!menu.permission||user.permissions.includes(menu.permission)||(menu.path==='/settings'&&user.role==='OWNER'));
 const sidebarItems=menus.filter(item=>item.path!=='/account'&&item.path!=='/reports/coupons'&&moduleAllowed(item.path)&&item.path!=='/reports/gateway'&&(item.path!=='/marketplace'||user.role==='OWNER')&&(item.path!=='/users'||user.role==='OWNER')&&(!item.permission||user.permissions.includes(item.permission)||(item.path==='/settings'&&user.role==='OWNER')));
 return <div className="workspace" data-sidebar-collapsed={collapsed}><WorkspaceSidebar items={sidebarItems} path={path} collapsed={collapsed} onToggle={toggleSidebar}/><section className={`workspace-content${path==='/dashboard'?' dashboard-content':''}`}><h1>{menu?<menu.icon size={28} aria-hidden="true"/>:null}{menu?.label??'ไม่พบหน้า'}</h1><PageLoadBoundary key={`${user.userId}:${user.orgId}:${path}`}><Suspense fallback={<p role="status">กำลังโหลดหน้า</p>}>{access.loading&&(path==='/coupons'||path==='/reports/coupons')?<p role="status">กำลังโหลดสิทธิ์โมดูล</p>:!allowed?<Notice>ไม่มีสิทธิ์เข้าถึงหน้านี้</Notice>:path==='/coupons'?<CouponsPage/>:path==='/reports/coupons'?<CouponReportPage/>:path==='/marketplace'?<MarketplacePage/>:path==='/dashboard'?<DashboardPage key={`${user.userId}:${user.orgId}`}/>:path==='/reports/gateway'?<GatewayReportPage key={`${user.userId}:${user.orgId}`}/>:path==='/reports'?<ReportsPage key={`${user.userId}:${user.orgId}`}/>:path==='/settings'?<SettingsPage readOnly={user.role==='ACCOUNTANT'} onStoreNameChanged={onStoreNameChanged} key={`${user.userId}:${user.orgId}`}/>:path==='/users'?<StaffPage canManage={user.role==='OWNER'} key={`${user.userId}:${user.orgId}`}/>:path==='/sales'?<SalesPage canVoid={user.permissions.includes('sales:void')} key={`${user.userId}:${user.orgId}`}/>:path==='/categories'?<CategoriesPage key={`${user.userId}:${user.orgId}`}/>:path==='/inventory'?<ProductsPage key={`${user.userId}:${user.orgId}`}/>:path==='/pos'?<PosPage canManage={user.role==='OWNER'} userId={user.userId} orgId={user.orgId} key={`${user.userId}:${user.orgId}`}/>:path==='/audits'?<AuditPage key={`${user.userId}:${user.orgId}`}/>:path==='/account'?<Account user={user}/>:<div className="module-pending"><menu.icon size={40} aria-hidden="true"/><p>ส่วนนี้อยู่ระหว่างพัฒนา</p></div>}</Suspense></PageLoadBoundary></section></div>;
}

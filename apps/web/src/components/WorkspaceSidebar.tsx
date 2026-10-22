import {PanelLeftClose,PanelLeftOpen,type LucideIcon} from 'lucide-react';
export type SidebarItem={path:string;label:string;icon:LucideIcon};
export function WorkspaceSidebar({items,path,collapsed,onToggle}:{items:SidebarItem[];path:string;collapsed:boolean;onToggle:()=>void}){
 const label=collapsed?'ขยายเมนู':'ย่อเมนู';
 return <nav className="sidebar" aria-label="เมนูหลัก">{items.map(({path:href,label,icon:Icon})=><a key={href} href={href} title={label} aria-label={label} aria-current={path===href||(href==='/reports'&&path.startsWith('/reports/'))?'page':undefined}><Icon size={24} aria-hidden="true"/><span className="menu-label">{label}</span></a>)}<button type="button" className="sidebar-toggle" title={label} aria-label={label} aria-expanded={!collapsed} onClick={onToggle}>{collapsed?<PanelLeftOpen size={22} aria-hidden="true"/>:<PanelLeftClose size={22} aria-hidden="true"/>}</button></nav>;
}

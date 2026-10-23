import {PanelLeftClose,PanelLeftOpen,type LucideIcon} from 'lucide-react';
export type SidebarItem={path:string;label:string;icon:LucideIcon};
export function WorkspaceSidebar({items,path,collapsed,onToggle}:{items:SidebarItem[];path:string;collapsed:boolean;onToggle:()=>void}){
 const bottom=items.filter(item=>['/settings','/users'].includes(item.path)),primary=items.filter(item=>!['/settings','/users'].includes(item.path));
 const links=(rows:SidebarItem[])=>rows.map(({path:href,label,icon:Icon})=><a key={href} href={href} title={label} aria-label={label} aria-current={path===href||(href==='/reports'&&path.startsWith('/reports/'))?'page':undefined}><Icon size={24} aria-hidden="true"/><span className="menu-label">{label}</span></a>);
 const label=collapsed?'ขยายเมนู':'ย่อเมนู';
 return <nav className="sidebar" aria-label="เมนูหลัก"><div className="sidebar-primary">{links(primary)}</div><div className="sidebar-bottom">{links(bottom)}<button type="button" className="sidebar-toggle" title={label} aria-label={label} aria-expanded={!collapsed} onClick={onToggle}>{collapsed?<PanelLeftOpen size={22} aria-hidden="true"/>:<PanelLeftClose size={22} aria-hidden="true"/>}</button></div></nav>;
}

import {useCallback,useState} from 'react';
import {ShoppingCart,ReceiptText,MoreHorizontal,LogOut,ExternalLink} from 'lucide-react';
import type {UserContext} from '../../../../../packages/contracts/src/index';
import {LinePos} from './LinePos';
import {LineSales} from './LineSales';
import {LineReceipt} from './LineReceipt';
import type {LineSale} from './schema';
// Keyed by user+shop in LineApp: a new login cannot inherit a prior receipt/tab.
export function LineWorkspace({user,onSignOut}:{user:UserContext;onSignOut:()=>void}){
 const [tab,setTab]=useState<'pos'|'sales'|'more'>('pos'),[sale,setSale]=useState<LineSale|null>(null),[locked,setLocked]=useState(false);
 const onLocked=useCallback((value:boolean)=>setLocked(value),[]),scope=`${user.userId}:${user.orgId}`;
 return <><p className="line-store">{user.orgName}</p>{sale?<LineReceipt sale={sale} onClose={()=>{setSale(null);setTab('pos');}}/>:tab==='pos'?<LinePos scope={scope} onSale={setSale} onLocked={onLocked}/>:tab==='sales'?<LineSales/>:<section className="line-more"><h1>บัญชีร้าน</h1><h2>{user.username}</h2><p>{user.role==='OWNER'?'เจ้าของร้าน':'พนักงานขาย'}</p><p className="line-muted">LINE MINI App · รับชำระเงินสดและแสดงใบเสร็จดิจิทัล</p><a className="line-secondary" href="/"><ExternalLink size={18}/>เปิดระบบเว็บ</a><button className="line-secondary" disabled={locked} onClick={onSignOut}><LogOut size={18}/>ออกจากระบบบนหน้านี้</button></section>}
 <nav className="line-bottom-nav" aria-label="เมนู KidTang บน LINE">{([{key:'pos',label:'ขายสินค้า',icon:ShoppingCart},{key:'sales',label:'รายการขาย',icon:ReceiptText},{key:'more',label:'เพิ่มเติม',icon:MoreHorizontal}] as const).map(({key,label,icon:Icon})=><button key={key} aria-current={tab===key&&!sale?'page':undefined} disabled={locked} onClick={()=>{setSale(null);setTab(key);}}><Icon size={22}/><span>{label}</span></button>)}</nav></>;
}

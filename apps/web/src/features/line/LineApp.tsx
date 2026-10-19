import {useEffect,useState} from 'react';
import {BrandLogo} from '../../components/BrandLogo';
import {useLineSession} from './useLineSession';
import {LineLogin} from './LineLogin';
import {LineWorkspace} from './LineWorkspace';
export function LineApp({inLine}:{inLine:boolean}){
 const account=useLineSession(),[online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 const canSell=account.user&&['OWNER','EMPLOYEE'].includes(account.user.role);
 return <div className="line-app"><header className="line-header"><BrandLogo/><span className={`line-connection${online?'':' is-offline'}`}><i/>{online?'ออนไลน์':'ออฟไลน์'}</span></header><main className="line-content">
 {!online?<p className="line-notice" role="status">ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบรายการเดิมก่อนส่งซ้ำ</p>:null}
 {!inLine?<p className="line-browser-note">เปิดจากเบราว์เซอร์ · ทดสอบใน LINE ผ่าน Developing LIFF URL</p>:null}
 {account.error?<p className="line-notice" role="alert">{account.error}</p>:null}
 {account.loading?<p className="line-loading" role="status">กำลังตรวจสอบบัญชี KidTang</p>:!account.session?<LineLogin/>:!account.user?<section className="line-center"><h1>ยังไม่สามารถเปิดร้านได้</h1><button className="line-primary" onClick={account.retry}>ตรวจสอบบัญชีอีกครั้ง</button><button className="line-secondary" onClick={()=>void account.signOut()}>ออกจากระบบ</button></section>:!canSell?<section><h1>บัญชีนี้ไม่มีสิทธิ์ขายสินค้า</h1><p>บัญชีสามารถเปิดรายงานผ่านระบบเว็บได้ตามสิทธิ์เดิม</p><a href="/reports">เปิดระบบเว็บ</a><button className="line-secondary" onClick={()=>void account.signOut()}>ออกจากระบบ</button></section>:<LineWorkspace key={`${account.user.userId}:${account.user.orgId}`} user={account.user} onSignOut={()=>void account.signOut()}/>}
 </main><footer className="line-footer">POWERED BY ZONE-IDEA INNOVATION CO.,LTD.</footer></div>;
}

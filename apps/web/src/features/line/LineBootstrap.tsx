import {lazy,Suspense,useEffect,useState} from 'react';
import {BrandLogo} from '../../components/BrandLogo';
import {initializeLiff} from './liff';
const LineApp=lazy(()=>import('./LineApp').then(m=>({default:m.LineApp})));
export function LineBootstrap(){
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading'),[inLine,setInLine]=useState(false),[revision,setRevision]=useState(0);
 const id=import.meta.env.VITE_LINE_LIFF_ID||'2012103465-KynjquiS';
 useEffect(()=>{let active=true;setState('loading');initializeLiff(id).then(sdk=>{if(active){setInLine(sdk.isInClient());setState('ready');}}).catch(()=>{if(active)setState('error');});return()=>{active=false;};},[id,revision]);
 if(state==='ready')return <Suspense fallback={<div className="line-app line-center" role="status">กำลังเตรียม POSJung</div>}><LineApp inLine={inLine}/></Suspense>;
 return <div className="line-app line-center"><BrandLogo/><h1>POSJung บน LINE</h1>{state==='loading'?<p role="status">กำลังเชื่อมต่อ LINE MINI App</p>:<><p role="alert">{id?'ไม่สามารถเริ่มต้น LINE MINI App ได้ กรุณาตรวจสอบการเชื่อมต่อและการตั้งค่า Endpoint':'ยังไม่ได้ตั้งค่า Developing LIFF ID สำหรับหน้านี้'}</p><button className="line-primary" onClick={()=>setRevision(v=>v+1)}>ลองเชื่อมต่ออีกครั้ง</button><a href="/">เปิด POSJung บนเว็บ</a></>}</div>;
}

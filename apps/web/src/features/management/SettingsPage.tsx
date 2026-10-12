import { useEffect,useState } from 'react';
import { Pencil,RefreshCw } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { getSettings,type Settings } from './client';
import { SettingsForm } from './SettingsForm';
import { StoreDetails } from './StoreDetails';
import { SettingsPreview } from './SettingsPreview';
import './management.css';
export function SettingsPage({onStoreNameChanged}:{onStoreNameChanged:(name:string)=>void}){const [item,setItem]=useState<Settings|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[edit,setEdit]=useState(false);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');getSettings(c.signal).then(value=>{if(!c.signal.aborted)setItem(value);}).catch(error=>{if(!c.signal.aborted)setError(authMessage(error));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision]);
 return <><div className="category-actions"><button className="secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/>โหลดใหม่</button><button className="primary" disabled={loading||!item||Boolean(error)} onClick={()=>setEdit(true)}><Pencil size={18}/>แก้ไขข้อมูลร้าน</button></div>{loading?<p role="status"><Busy/>กำลังโหลดข้อมูลร้าน</p>:null}{error?<Notice>{error}</Notice>:null}{item&&!error?<div className="settings-details"><StoreDetails value={item}/><SettingsPreview value={item}/></div>:null}{edit&&item?<SettingsForm item={item} onClose={()=>setEdit(false)} onSaved={name=>{onStoreNameChanged(name);setEdit(false);setRevision(v=>v+1);}}/>:null}</>;
}

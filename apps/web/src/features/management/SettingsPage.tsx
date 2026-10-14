import {PrinterSettings} from '../printing/PrinterSettings';
import { useEffect,useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Busy,Notice } from '../../components/Notice';
import { authMessage } from '../../lib/client';
import { getSettings,type Settings } from './client';
import { SettingsForm } from './SettingsForm';
import './management.css';
export function SettingsPage({onStoreNameChanged}:{onStoreNameChanged:(name:string)=>void}){const [item,setItem]=useState<Settings|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');getSettings(c.signal).then(value=>{if(!c.signal.aborted)setItem(value);}).catch(error=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดข้อมูลได้');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision]);
 return <>{loading?<p role="status"><Busy/>กำลังโหลดข้อมูลร้าน</p>:null}{error?<Notice>{error}</Notice>:null}{<SettingsForm disabled={!item||loading||Boolean(error)} key={item?.version??'unavailable'} item={item??{storeName:'',address:'',phone:'',taxId:'',promptpayIdentifier:'',receiptFooter:'',vatEnabled:false,vatRate:'0.00',autoOpenPrintDialog:false,version:1}} onSaved={name=>{onStoreNameChanged(name);setRevision(v=>v+1);}}/>}<PrinterSettings/></>;
}

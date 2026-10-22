import {useEffect,useState} from 'react';import {cafeConfiguration,type CafeConfiguration} from '@pos/contracts/cafe-options';
// The caller supplies its authenticated transport; LINE keeps its isolated session client.
export function useCafeConfiguration(load:(signal:AbortSignal)=>Promise<unknown>){
 const [data,setData]=useState<CafeConfiguration|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();setError('');load(c.signal).then(v=>{if(!c.signal.aborted)setData(cafeConfiguration.parse(v));}).catch(()=>{if(!c.signal.aborted)setError('ไม่สามารถโหลดตัวเลือกเมนูได้');});return()=>c.abort();},[load,revision]);
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 return {data,error,loading:!data&&!error,reload:()=>setRevision(v=>v+1)};
}

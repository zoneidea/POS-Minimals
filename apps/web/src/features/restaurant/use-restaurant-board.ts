import {useEffect,useState} from 'react';
import type {RestaurantBill,RestaurantTable} from '@pos/contracts/restaurant';
import {authMessage} from '../../lib/client';
import {getBoard,getManagementTables} from './client';
export function useRestaurantBoard(autoRefresh=true,management=false){
 const [tables,setTables]=useState<RestaurantTable[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const reload=()=>setRevision(v=>v+1);
 useEffect(()=>{const c=new AbortController();(management?getManagementTables:getBoard)(c.signal).then(r=>{if(!c.signal.aborted){setTables(r.tables);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision,management]);
 useEffect(()=>{if(!autoRefresh)return;const refresh=()=>{if(!document.hidden)reload();},timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[autoRefresh]);
 return {tables,loading,error,reload,acceptBill:(bill:RestaurantBill)=>{setTables(rows=>rows.map(t=>t.id===bill.tableId?{...t,bill:bill.status==='OPEN'?bill:null}:t));reload();}};
}

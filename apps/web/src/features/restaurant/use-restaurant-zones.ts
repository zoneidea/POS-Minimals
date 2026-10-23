import {useEffect,useState} from 'react';
import type {RestaurantZone} from '@pos/contracts/restaurant';
import {authMessage} from '../../lib/client';
import {getZones} from './client';
export function useRestaurantZones(){
 const [zones,setZones]=useState<RestaurantZone[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();getZones(c.signal).then(rows=>{if(!c.signal.aborted){setZones(rows);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(authMessage(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[revision]);
 return {zones,error,loading,reload:()=>setRevision(n=>n+1)};
}

import {useEffect,useState,useRef} from 'react';
import {call} from '../management/client';
export const storeModeChangedEvent='pos:store-mode-changed';
export function useRestaurantNavigation(enabled:boolean){
 const initialized=useRef(false);
 const [restaurant,setRestaurant]=useState(false),[loading,setLoading]=useState(enabled),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!enabled){initialized.current=false;setRestaurant(false);setLoading(false);return;}const c=new AbortController();if(!initialized.current)setLoading(true);call('/settings/store-mode',undefined,undefined,c.signal).then(v=>{if(!c.signal.aborted){setRestaurant((v as {storeMode?:string}).storeMode==='RESTAURANT');initialized.current=true;}}).catch(()=>{if(!c.signal.aborted&&!initialized.current)setRestaurant(false);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[enabled,revision]);
 useEffect(()=>{if(!enabled)return;const refresh=()=>setRevision(v=>v+1);window.addEventListener(storeModeChangedEvent,refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener(storeModeChangedEvent,refresh);window.removeEventListener('focus',refresh);};},[enabled]);
 return {restaurant,loading};
}

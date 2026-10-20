import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {getEntitlements} from '../coupons/client';
import {moduleAccessState,type ModuleEntitlements} from './entitlement-state';
import {moduleChangeKey} from './module-events';
const initial={coupons:false,purchasedCoupons:false,loading:true,error:''};
const Context=createContext({...initial,refresh:()=>{},applyEntitlements:(_value:ModuleEntitlements)=>{}});
export const useModuleAccess=()=>useContext(Context);
export function ModuleAccessProvider({children}:{children:ReactNode}){
 const [revision,setRevision]=useState(0),[state,setState]=useState(initial),pending=useRef<AbortController|null>(null);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 const applyEntitlements=useCallback((value:ModuleEntitlements)=>{pending.current?.abort();setState(moduleAccessState(value));},[]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===moduleChangeKey)refresh();};window.addEventListener('focus',refresh);window.addEventListener('storage',changed);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',changed);};},[refresh]);
 useEffect(()=>{const c=new AbortController();pending.current=c;getEntitlements(c.signal).then(v=>{if(!c.signal.aborted)setState(moduleAccessState(v));}).catch(()=>{if(!c.signal.aborted)setState({...initial,loading:false,error:'ไม่สามารถโหลดสิทธิ์โมดูลได้'});});return()=>c.abort();},[revision]);
 return <Context.Provider value={{...state,refresh,applyEntitlements}}>{children}</Context.Provider>;
}

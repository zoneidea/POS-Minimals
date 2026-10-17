import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {getEntitlements} from '../coupons/client';
const Context=createContext({coupons:false,loading:true,error:'',refresh:()=>{}});
export const useModuleAccess=()=>useContext(Context);
export function ModuleAccessProvider({children}:{children:ReactNode}){
 const [revision,setRevision]=useState(0),[state,setState]=useState({coupons:false,loading:true,error:''});
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 useEffect(()=>{const c=new AbortController();getEntitlements(c.signal).then(v=>{if(!c.signal.aborted)setState({...v,loading:false,error:''});}).catch(()=>{if(!c.signal.aborted)setState({coupons:false,loading:false,error:'ไม่สามารถโหลดสิทธิ์โมดูลได้'});});return()=>c.abort();},[revision]);
 return <Context.Provider value={{...state,refresh:()=>setRevision(v=>v+1)}}>{children}</Context.Provider>;
}

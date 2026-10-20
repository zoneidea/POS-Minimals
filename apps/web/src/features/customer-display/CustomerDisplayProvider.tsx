import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {CartItem} from '../pos/cart';
import type {CompletedSale} from '../pos/checkout-client';
import {printerProfile} from '../printing/agent-client';
import {cartDisplay,checkoutDisplay,completedDisplay,withCustomerQr,type CheckoutDisplayInput,type CustomerFrame,type CustomerQr} from './model';
import {configureCustomerDisplay,sendCustomerFrame,releaseCustomerDisplay,displayPreference,displayPreferenceKey,deviceSettingsEvent} from './client';
import {CustomerDisplaySession} from './session';
import './customer-display.css';
interface Control{setCheckout:(frame:CustomerFrame|null)=>void;setQr:(qr:CustomerQr|null)=>void;complete:(sale:CompletedSale)=>void;clearPayment:()=>void;}
const controls=createContext<Control>({setCheckout(){},setQr(){},complete(){},clearPayment(){}});
export const useCustomerDisplay=()=>useContext(controls);
export function CustomerDisplayProvider({items,scope,children}:{items:CartItem[];scope:string;children:ReactNode}){
 const [checkout,setCheckout]=useState<CustomerFrame|null>(null),[qr,setQr]=useState<CustomerQr|null>(null),[completed,setCompleted]=useState<CustomerFrame|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const stream=useRef<CustomerDisplaySession|null>(null);
 const draft=useMemo(()=>cartDisplay(items),[items]);
 const frame=useMemo(()=>completed&&!items.length?completed:withCustomerQr(checkout??draft,qr),[completed,items.length,checkout,draft,qr]);
 const latest=useRef(frame);latest.current=frame;
 const clearPayment=useCallback(()=>{setCheckout(null);setQr(null);},[]);
 const complete=useCallback((sale:CompletedSale)=>{setCheckout(null);setQr(null);setCompleted(completedDisplay(sale));},[]);
 const control=useMemo(()=>({setCheckout,setQr,complete,clearPayment}),[complete,clearPayment]);
 useEffect(()=>{if(items.length)setCompleted(null);},[items]);
 useEffect(()=>{if(!completed)return;const timer=setTimeout(()=>setCompleted(null),8000);return()=>clearTimeout(timer);},[completed]);
 useEffect(()=>{const changed=(event:Event)=>{if(event instanceof StorageEvent&&event.key!==null&&![displayPreferenceKey,'pos:printer-settings:v1'].includes(event.key))return;setRevision(n=>n+1);};window.addEventListener('storage',changed);window.addEventListener(deviceSettingsEvent,changed);return()=>{window.removeEventListener('storage',changed);window.removeEventListener(deviceSettingsEvent,changed);};},[]);
 useEffect(()=>{
  const settings=displayPreference(),profile=printerProfile();let active=true;
  if(!settings.enabled){setError('');return;}
  if(!profile){setError('จอลูกค้า: กรุณาจับคู่ posjung-agent ที่หน้าตั้งค่าร้าน');return;}
  const session=new CustomerDisplaySession({configure:()=>configureCustomerDisplay(profile.token,settings),send:(id,sequence,value)=>sendCustomerFrame(profile.token,id,sequence,value),release:id=>releaseCustomerDisplay(profile.token,id),newId:()=>crypto.randomUUID(),error:message=>{if(active)setError(message?`จอลูกค้า: ${message}`:'');}});
  stream.current=session;session.update(latest.current);
  const timer=setInterval(()=>void session.flush(),5000),hide=()=>session.close(),show=(event:PageTransitionEvent)=>{if(event.persisted)setRevision(n=>n+1);},visible=()=>{if(document.visibilityState==='visible')void session.flush();};
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);document.removeEventListener('visibilitychange',visible);session.close();if(stream.current===session)stream.current=null;};
 },[scope,revision]);
 useEffect(()=>{stream.current?.update(frame);},[frame]);
 return <controls.Provider value={control}>{children}{error?<p className="customer-display-status" role="status">{error} · การขายยังใช้งานได้ตามปกติ</p>:null}</controls.Provider>;
}
export function useCheckoutCustomerDisplay(input:CheckoutDisplayInput){
 const {setCheckout}=useCustomerDisplay();
 const frame=useMemo(()=>checkoutDisplay(input),[input.items,input.quote,input.due,input.received,input.mode,input.pending]);
 useEffect(()=>{setCheckout(frame);},[frame,setCheckout]);useEffect(()=>()=>setCheckout(null),[setCheckout]);
}
export function useCustomerQr(value:CustomerQr|null){
 const {setQr}=useCustomerDisplay(),image=value?.image,amount=value?.amount,mode=value?.mode,expiresAt=value?.expiresAt;
 useEffect(()=>{setQr(image&&amount&&mode?{image,amount,mode,expiresAt:expiresAt??null}:null);return()=>setQr(null);},[image,amount,mode,expiresAt,setQr]);
}
export function CustomerQrSync({value}:{value:CustomerQr|null}){useCustomerQr(value);return null;}

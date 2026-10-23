import {useRef,useState,useEffect,type SetStateAction} from 'react';
import type {CartItem} from './cart';
import {logParkedCart} from './parked-cart-log';
import {readParkedWorkspace,writeParkedWorkspace,parkedWorkspaceKey,parkCart,recallCart,assertNoPendingPayment,type ParkedWorkspace} from './parked-cart-storage';
export function useParkedCart(userId:string,orgId:string){
 const scope=`${userId}:${orgId}`;
 const [state,setState]=useState<{value:ParkedWorkspace;error:string;blocked:boolean}>(()=>{try{return {value:readParkedWorkspace(scope),error:'',blocked:false};}catch{return {value:{version:1,revision:0,items:[],bills:[]},error:'อ่านตะกร้าในเครื่องไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บก่อนทำรายการ',blocked:true};}}),current=useRef(state);
 const update=(make:(value:ParkedWorkspace)=>ParkedWorkspace)=>{
  if(current.current.blocked)throw new Error(current.current.error);
  const value=writeParkedWorkspace(scope,current.current.value,make(current.current.value));const next={value,error:'',blocked:false};current.current=next;setState(next);
 };
 useEffect(()=>{const refresh=(event:StorageEvent)=>{if(event.key!==parkedWorkspaceKey(scope))return;try{const next={value:readParkedWorkspace(scope),error:'',blocked:false};current.current=next;setState(next);}catch{const next={...current.current,error:'อ่านข้อมูลตะกร้าจากอีกหน้าต่างไม่ได้ กรุณาเปิดหน้า POS ใหม่',blocked:true};current.current=next;setState(next);}};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[scope]);
 return {items:state.value.items,bills:state.value.bills,error:state.error,blocked:state.blocked,
 setItems:(value:SetStateAction<CartItem[]>)=>{try{update(w=>({...w,items:typeof value==='function'?value(w.items):value}));}catch(e){const next={...current.current,error:e instanceof Error?e.message:'บันทึกตะกร้าในเครื่องไม่ได้',blocked:true};current.current=next;setState(next);}},
 park:()=>{assertNoPendingPayment(scope);update(w=>parkCart(w,crypto.randomUUID(),new Date().toISOString()));logParkedCart(scope,'PARK',current.current.value.bills.length);},
 recall:(id:string)=>{assertNoPendingPayment(scope);update(w=>recallCart(w,id));logParkedCart(scope,'RECALL',current.current.value.bills.length);},
 discard:(id:string)=>{assertNoPendingPayment(scope);update(w=>({...w,bills:w.bills.filter(b=>b.id!==id)}));logParkedCart(scope,'DISCARD',current.current.value.bills.length);}
 };
}

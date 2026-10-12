import { useRef,useState,type SetStateAction } from 'react';
import type { CartItem } from './cart';
import { restoreCart,persistCart } from './cart-storage';
export function useCart(userId:string,orgId:string){
 const [state,setState]=useState(()=>restoreCart(userId,orgId));
 const current=useRef(state.items);
 const setItems=(update:SetStateAction<CartItem[]>)=>{
  const items=typeof update==='function'?update(current.current):update;
  let error='';
  // Save before navigation/reload can unmount the POS screen.
  try{persistCart(userId,orgId,items);}catch{error='ไม่สามารถเก็บตะกร้าในเครื่องได้ ตะกร้าอาจหายเมื่อรีเฟรช';}
  current.current=items;setState({items,error});
 };
 return {items:state.items,setItems,error:state.error};
}

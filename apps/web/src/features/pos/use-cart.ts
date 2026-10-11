import { useEffect,useState } from 'react';
import { cartKey,cartSchema,type CartItem } from './cart';
export function useCart(userId:string,orgId:string){
 const key=cartKey(userId,orgId);
 const [error,setError]=useState('');
 const [items,setItems]=useState<CartItem[]>(()=>{try{const saved=localStorage.getItem(key);return saved?cartSchema.parse(JSON.parse(saved)):[];}catch{return [];}});
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(items));setError('');}catch{setError('ไม่สามารถเก็บตะกร้าในเครื่องได้ ตะกร้าอาจหายเมื่อรีเฟรช');}},[key,items]);
 return {items,setItems,error};
}

import { cartKey,cartSchema,type CartItem } from './cart';
type CartStorage=Pick<Storage,'getItem'|'setItem'>;
export function restoreCart(userId:string,orgId:string,storage?:CartStorage):{items:CartItem[];error:string}{
 try{const saved=(storage??localStorage).getItem(cartKey(userId,orgId));return {items:saved?cartSchema.parse(JSON.parse(saved)):[],error:''};}
 catch{return {items:[],error:'อ่านตะกร้าที่เก็บไว้ไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์'};}
}
export function persistCart(userId:string,orgId:string,items:CartItem[],storage:CartStorage=localStorage){
 storage.setItem(cartKey(userId,orgId),JSON.stringify(items));
}

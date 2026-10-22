import {optionSnapshot} from '@pos/contracts/cafe-options';
import { z } from 'zod';
import type { CatalogProduct } from './client';
export const cartSchema=z.array(z.object({lineId:z.uuid().optional(),baseUnitPrice:z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/).optional(),optionIds:z.array(z.uuid()).max(100).optional(),options:z.array(optionSnapshot).optional(),note:z.string().max(200).optional(),id:z.uuid(),name:z.string().max(200),barcode:z.string().max(100),salePrice:z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/),quantity:z.number().int().min(1).max(2147483647),stock:z.number().int().nonnegative().max(2147483647)}).strict()).max(200);
export type CartItem=z.infer<typeof cartSchema>[number];
export function cartKey(userId:string,orgId:string){return `pos:cart:v1:${userId}:${orgId}`;}
export function addToCart(items:CartItem[],product:CatalogProduct):CartItem[]{
 const current=items.find(item=>item.id===product.id&&!item.lineId);
 if(product.quantityOnHand<=0||items.filter(i=>i.id===product.id).reduce((s,i)=>s+i.quantity,0)>=product.quantityOnHand||(!current&&items.length>=200))return items;
 const next={id:product.id,name:product.name,barcode:product.barcode,salePrice:product.salePrice,stock:product.quantityOnHand,quantity:(current?.quantity??0)+1};
 return current?items.map(item=>item===current?next:item):[...items,next];
}
export function changeQuantity(items:CartItem[],id:string,delta:number){return items.flatMap(item=>{
 if((item.lineId??item.id)!==id)return [item];const quantity=item.quantity+delta;
 return quantity<=0?[]:quantity>item.stock?[item]:[{...item,quantity}];
});}
export function cartTotal(items:CartItem[]){return items.reduce((sum,item)=>sum+BigInt(item.salePrice.replace('.',''))*BigInt(item.quantity),0n);}
export function formatAmount(cents:bigint){return `${(cents/100n).toLocaleString('th-TH')}.${String(cents%100n).padStart(2,'0')}`;}

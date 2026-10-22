import type {CafeOptionSnapshot} from '@pos/contracts/cafe-options';
import type {CartItem} from '../pos/cart';
import type {CatalogProduct} from '../pos/client';
export const cartLineKey=(item:CartItem)=>item.lineId??item.id;
export const quoteLine=(item:CartItem)=>({productId:item.id,quantity:item.quantity,...(item.lineId?{lineId:item.lineId,optionIds:item.optionIds??[],note:item.note??''}:{})});
export function checkoutLine(row:{productId:string;quantity:number;unitPrice:string;expectedVersion:number;lineId?:string;optionIds?:string[];note?:string;optionsFingerprint?:string}){return {productId:row.productId,quantity:row.quantity,expectedUnitPrice:row.unitPrice,expectedVersion:row.expectedVersion,...(row.lineId?{lineId:row.lineId,optionIds:row.optionIds??[],note:row.note??'',expectedOptionsFingerprint:row.optionsFingerprint}:{})};}
export function applyCafeLine(items:CartItem[],product:CatalogProduct,options:CafeOptionSnapshot[],note:string,quantity=1,editing?:string){
 const rest=editing?items.filter(i=>cartLineKey(i)!==editing):items;
 if(quantity<1||!Number.isInteger(quantity)||rest.filter(i=>i.id===product.id).reduce((s,i)=>s+i.quantity,0)+quantity>product.quantityOnHand)throw new Error('จำนวนสินค้ารวมเกินสต็อกที่มี');
 const ids=options.map(o=>o.id).sort(),trimmed=note.trim(),price=BigInt(product.salePrice.replace('.',''))+options.reduce((s,o)=>s+BigInt(o.price.replace('.','')),0n);
 const salePrice=`${price/100n}.${String(price%100n).padStart(2,'0')}`;
 const existing=rest.find(i=>i.id===product.id&&i.salePrice===salePrice&&(i.note??'')===trimmed&&JSON.stringify([...(i.optionIds??[])].sort())===JSON.stringify(ids));
 if(existing)return rest.map(i=>i===existing?{...i,quantity:i.quantity+quantity}:i);
 if(rest.length>=200)throw new Error('ตะกร้ามีรายการครบ 200 รายการแล้ว');
 return [...rest,{id:product.id,lineId:editing??crypto.randomUUID(),name:product.name,barcode:product.barcode,salePrice,baseUnitPrice:product.salePrice,stock:product.quantityOnHand,quantity,optionIds:ids,options,note:trimmed}];
}

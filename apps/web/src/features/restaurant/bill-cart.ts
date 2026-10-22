import type {RestaurantBill} from '@pos/contracts/restaurant';
import type {CartItem} from '../pos/cart';
export function billCartItems(bill:RestaurantBill):CartItem[]{return bill.rounds.filter(r=>!r.cancelled).flatMap(r=>r.items.map(i=>({id:i.productId,lineId:i.lineId,name:i.name,barcode:i.barcode,salePrice:i.unitPrice,baseUnitPrice:i.baseUnitPrice,quantity:i.quantity,options:i.options,optionIds:i.optionIds,note:i.note,trackStock:false,stock:2147483647})));}
export const restaurantCashKey=(scope:string,billId:string)=>`${scope}:restaurant:cash:${billId}`;

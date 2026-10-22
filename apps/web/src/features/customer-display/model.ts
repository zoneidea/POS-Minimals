import {z} from 'zod';
import type {CartItem} from '../pos/cart';
import type {CompletedSale} from '../pos/checkout-client';
import type {useCashQuote} from '../pos/use-cash-quote';
import {amountInput} from '../pos/checkout-amounts';
export const displayMoney=z.string().regex(/^(0|[1-9]\d{0,29})\.\d{2}$/);
export const customerQrSchema=z.object({image:z.string().max(200000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),expiresAt:z.number().int().positive().nullable(),amount:displayMoney,mode:z.enum(['UPLOAD','GATEWAY'])}).strict();
export type CustomerQr=z.infer<typeof customerQrSchema>;
export interface CustomerItem{name:string;quantity:number;unitPrice:string;lineTotal:string;}
export interface CustomerFrame{kind:'cart'|'payment'|'completed';items:CustomerItem[];subtotal:string;discount:string;total:string|null;received:string|null;change:string|null;paymentMethod:'CASH'|'PROMPTPAY'|null;qr:CustomerQr|null;}
const detailName=(name:string,item:{options?:{name:string}[];note?:string})=>item.options?.length||item.note?[name,item.options?.map(o=>o.name).join(' · '),item.note].filter(Boolean).join(' · ').slice(0,200):name;
export function cartDisplay(items:CartItem[]):CustomerFrame{
 const rows=items.map(item=>({name:detailName(item.name,item),quantity:item.quantity,unitPrice:item.salePrice,lineTotal:amountInput(BigInt(item.salePrice.replace('.',''))*BigInt(item.quantity))}));
 const total=amountInput(rows.reduce((sum,item)=>sum+BigInt(item.lineTotal.replace('.','')),0n));
 return {kind:'cart',items:rows,subtotal:total,discount:'0.00',total,received:null,change:null,paymentMethod:null,qr:null};
}
export type CheckoutDisplayInput={items:CartItem[];quote:ReturnType<typeof useCashQuote>['quote'];due:bigint|null;received:bigint|null;mode:string;pending:boolean};
export function checkoutDisplay(input:CheckoutDisplayInput):CustomerFrame{
 const draft=cartDisplay(input.items),quote=input.quote,total=input.pending?null:input.due;
 return {...draft,kind:'payment',items:quote?quote.items.map(item=>({name:detailName(item.name,item),quantity:item.quantity,unitPrice:item.unitPrice,lineTotal:item.lineTotal})):draft.items,subtotal:quote?.subtotalAmount??draft.subtotal,discount:quote?.discountAmount??'0.00',total:total===null?null:amountInput(total),paymentMethod:input.mode==='cash'?'CASH':'PROMPTPAY',received:input.mode==='cash'&&input.received!==null?amountInput(input.received):null,change:input.mode==='cash'&&total!==null&&input.received!==null&&input.received>=total?amountInput(input.received-total):null};
}
export function completedDisplay(sale:CompletedSale):CustomerFrame{
 const receipt=sale.receipt;
 return {kind:'completed',items:receipt.items.map(item=>({name:detailName(item.productName,item),quantity:item.quantity,unitPrice:item.unitPrice,lineTotal:item.lineTotal})),subtotal:receipt.totals.subtotal,discount:receipt.totals.discount,total:receipt.totals.total,received:receipt.totals.received,change:receipt.totals.change,paymentMethod:receipt.paymentMethod??'CASH',qr:null};
}
export function withCustomerQr(frame:CustomerFrame,qr:CustomerQr|null,now=Date.now()):CustomerFrame{
 const parsed=customerQrSchema.safeParse(qr);
 const valid=parsed.success&&frame.kind==='payment'&&frame.paymentMethod==='PROMPTPAY'&&frame.total===parsed.data.amount&&(parsed.data.mode==='UPLOAD'?parsed.data.expiresAt===null:parsed.data.expiresAt!==null&&parsed.data.expiresAt>now);
 return {...frame,qr:valid?parsed.data:null};
}

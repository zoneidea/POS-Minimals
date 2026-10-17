import {couponCode} from '../coupons/schema.js';
import { z } from 'zod';
import type { UserContext } from '../auth/types.js';
const money=z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const checkoutInput=z.object({items:z.array(z.object({productId:z.uuid(),quantity:z.number().int().min(1).max(2147483647),expectedUnitPrice:money,expectedVersion:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)}).strict()).min(1).max(200).refine(items=>new Set(items.map(item=>item.productId)).size===items.length),discountAmount:money,couponCode:couponCode.optional(),expectedTotalAmount:money,payment:z.object({method:z.literal('CASH'),receivedAmount:money}).strict()}).strict();
export const receiptSchema=z.object({coupon:z.object({code:z.string(),name:z.string(),amount:money}).optional(),couponOffers:z.array(z.object({code:z.string(),name:z.string(),amount:money,endsOn:z.iso.date()})).optional(),receiptSchemaVersion:z.literal(1),saleId:z.uuid(),saleNo:z.string(),completedAtUtc:z.iso.datetime({offset:true}),items:z.array(z.object({barcode:z.string(),productName:z.string(),quantity:z.number().int().positive(),unitPrice:money,discountAmount:money,lineTotal:money})),totals:z.object({subtotal:money,discount:money,vat:money,total:money,received:money,change:money}),vatRate:money,vatEnabled:z.boolean(),paymentMethod:z.enum(['CASH','PROMPTPAY']),saleStatus:z.literal('COMPLETED')});
export const storedSale=z.object({saleId:z.uuid(),saleNo:z.string(),status:z.literal('COMPLETED'),totalAmount:money,receivedAmount:money,changeAmount:money,identityCipher:z.string(),receipt:receiptSchema,replayed:z.boolean().optional()});
export type Sale=z.infer<typeof storedSale> & {receipt:z.infer<typeof receiptSchema>&{store:{name:string};cashierName:string}};
export interface CheckoutService {
 commit(token:string,context:UserContext,input:z.infer<typeof checkoutInput>,key:string,requestId:string):Promise<Omit<Sale,'identityCipher'>>;
 recover(token:string,context:UserContext,key:string):Promise<Omit<Sale,'identityCipher'>>;
}

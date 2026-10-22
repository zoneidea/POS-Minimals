import {cafeLineFields,cafeExpectedFields,cafeReceiptFields} from '@pos/contracts/cafe-options';
import { z } from 'zod';
import { auth,request,RequestError } from '../../lib/client';
const money=z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const cashSaleInput=z.object({items:z.array(z.object({...cafeLineFields,...cafeExpectedFields,productId:z.uuid(),quantity:z.number().int().positive(),expectedUnitPrice:money,expectedVersion:z.number().int().positive()})).min(1).max(200),discountAmount:money,couponCode:z.string().regex(/^[A-Z0-9_-]{3,32}$/).optional(),expectedTotalAmount:money,payment:z.object({method:z.literal('CASH'),receivedAmount:money})});
export type CashSaleInput=z.infer<typeof cashSaleInput>;
const receipt=z.object({restaurant:z.object({billId:z.uuid(),tableName:z.string()}).optional(),cafe:z.object({queueNo:z.string().regex(/^A[0-9]{3,}$/),queueDate:z.iso.date()}).optional(),coupon:z.object({code:z.string(),name:z.string(),amount:money}).optional(),couponOffers:z.array(z.object({code:z.string(),name:z.string(),amount:money,endsOn:z.iso.date()})).optional(),paymentMethod:z.enum(['CASH','PROMPTPAY']).optional(),saleId:z.uuid(),saleNo:z.string(),completedAtUtc:z.iso.datetime({offset:true}),store:z.object({name:z.string()}),cashierName:z.string(),items:z.array(z.object({...cafeReceiptFields,barcode:z.string(),productName:z.string(),quantity:z.number().int().positive(),unitPrice:money,discountAmount:money,lineTotal:money})),totals:z.object({subtotal:money,discount:money,vat:money,total:money,received:money,change:money})});
export const completedSaleSchema=z.object({saleId:z.uuid(),saleNo:z.string(),status:z.literal('COMPLETED'),totalAmount:money,receivedAmount:money,changeAmount:money,receipt,replayed:z.boolean().optional()});
export type CompletedSale=z.infer<typeof completedSaleSchema>;
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export async function commitCashSale(input:CashSaleInput,key:string){return completedSaleSchema.parse(await request('/sales',await token(),input,undefined,'POST',key));}
export async function recoverCashSale(key:string){return completedSaleSchema.parse(await request(`/sales/by-idempotency-key/${key}`,await token()));}
export async function recoverOrRetryCashSale(input:CashSaleInput,key:string){
 try{return await recoverCashSale(key);}catch(error){
  if(error instanceof RequestError&&error.status===404)return commitCashSale(input,key);
  throw error;
 }
}

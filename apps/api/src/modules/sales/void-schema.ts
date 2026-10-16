import { z } from 'zod';
export const voidInput=z.object({reason:z.string().trim().min(1).max(500)}).strict();
export const voidResult=z.object({saleId:z.uuid(),status:z.literal('VOIDED'),voidedAtUtc:z.iso.datetime({offset:true}),replayed:z.boolean()});
export const saleSummary=z.object({id:z.uuid(),saleNo:z.string(),status:z.enum(['COMPLETED','VOIDED']),totalAmount:z.string(),cashierName:z.string(),itemCount:z.number().int().nonnegative(),gatewayPayment:z.boolean().default(false),paymentMethod:z.enum(['CASH','PROMPTPAY']),receivedAmount:z.string(),completedAtUtc:z.iso.datetime({offset:true}),voidDeadlineUtc:z.iso.datetime({offset:true}),voidedAtUtc:z.iso.datetime({offset:true}).nullable(),voidReason:z.string().nullable()});
export const saleList=z.object({items:z.array(saleSummary),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.literal(10)});
import type { UserContext } from '../auth/types.js';
export interface SaleManagementService {list(token:string,context:UserContext,page:number):Promise<z.infer<typeof saleList>>;void(token:string,id:string,reason:string,requestId:string):Promise<z.infer<typeof voidResult>>}

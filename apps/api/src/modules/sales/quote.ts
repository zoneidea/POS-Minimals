import {cafeMessages} from '../cafe-options/service.js';
import {cafeLineFields,cafeQuoteFields,uniqueCartLines} from '@pos/contracts/cafe-options';
import {couponCode} from '../coupons/schema.js';
import {couponMessages} from '../coupons/service.js';
import { z } from 'zod';
import { Router } from 'express';
import { ApiError } from '../../infra/errors.js';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { bearerToken } from '../../middleware/bearer.js';
import type { ResolveIdentity } from '../auth/types.js';
const money=z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const quoteInput=z.object({items:z.array(z.object({...cafeLineFields,productId:z.uuid(),quantity:z.number().int().min(1).max(2147483647)}).strict()).min(1).max(200).refine(uniqueCartLines),discountAmount:money,couponCode:couponCode.optional(),paymentMethod:z.enum(['CASH','PROMPTPAY'])}).strict();
export const quoteResult=z.object({manualDiscountAmount:money.optional(),couponDiscountAmount:money.optional(),couponCode:z.string().optional(),quoteFingerprint:z.string(),items:z.array(z.object({...cafeQuoteFields,productId:z.uuid(),barcode:z.string(),name:z.string(),quantity:z.number().int().positive(),unitPrice:money,expectedVersion:z.number().int().positive(),lineTotal:money,stockAvailable:z.number().int().nonnegative()})),subtotalAmount:money,discountAmount:money,totalAmount:money,vatAmount:money,vatEnabled:z.boolean(),vatRate:money,promptpayQrPayload:z.null()});
export type QuoteService=(token:string,input:z.infer<typeof quoteInput>)=>Promise<z.infer<typeof quoteResult>>;
export function createQuoteService(url:string,key:string):QuoteService{return async(token,input)=>{
 const {data,error}=await createUserClient(url,key,token).rpc('quote_coupon_sale',{p_items:input.items,p_discount:input.discountAmount,p_coupon_code:input.couponCode??null});
 if(error){const status:Record<string,number>={PT400:400,PT403:403,PT409:409};const messages:Record<string,string>={...cafeMessages,...couponMessages,INSUFFICIENT_STOCK:'สต็อกไม่เพียงพอ กรุณากลับไปตรวจสอบตะกร้า',PRODUCT_UNAVAILABLE:'สินค้าถูกลบหรือไม่พร้อมขาย กรุณาตรวจสอบตะกร้า',INVALID_DISCOUNT:'ส่วนลดมากกว่ายอดสินค้า'};throw new ApiError(status[error.code]??503,status[error.code]?error.message:'SERVICE_UNAVAILABLE',messages[error.message]??'คำนวณยอดขายไม่สำเร็จ');}
 return quoteResult.parse(data);
};}
export function quoteRoutes(resolve:ResolveIdentity,service:QuoteService){const router=Router();router.post('/quote',async(req,res)=>{
 const token=bearerToken(req.header('Authorization')),context=await resolve(token);
 if(context.role!=='OWNER'&&context.role!=='EMPLOYEE')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์เข้าหน้าขาย');
 const input=quoteInput.safeParse(req.body);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลตะกร้าไม่ถูกต้อง');
 if(input.data.paymentMethod!=='CASH')throw new ApiError(409,'PAYMENT_UNAVAILABLE','PromptPay อยู่ระหว่างพัฒนา');
 res.json({success:true,data:await service(token,input.data)});
});return router;}

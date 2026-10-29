import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {createUserClient} from '../../infra/supabase/user-client.js';
import type {UserContext} from '../auth/types.js';
import {storedSale} from '../sales/checkout-schema.js';
import {snapshotCipher} from '../sales/snapshot-cipher.js';
const minor=z.number().int().nonnegative().safe();
export const providerPayment=z.object({payment_id:z.string().regex(/^pay_[\w-]+$/),external_id:z.string(),status:z.string(),amount:minor,currency:z.literal('THB'),payment_method:z.literal('PROMPTPAY'),expires_at:z.number().int().positive().max(8640000000000).nullable().optional(),captured_at:z.number().int().positive().nullable(),fees:z.array(z.object({fee_id:z.string(),kind:z.string(),parent_id:z.string(),unit_amount:minor,percentage_amount:minor})).max(1000)});
export function verifiedAmounts(raw:unknown,paymentId:string,hash:string,amount:string){
 const parsed=providerPayment.safeParse(raw);if(!parsed.success)throw new ApiError(502,'INVALID_PAYMENT_DATA','ข้อมูลจากผู้ให้บริการไม่ครบถ้วน กรุณาตรวจสอบรายการเดิม');
 const p=parsed.data;
 if(p.payment_id!==paymentId||p.external_id!==`pos_${hash}`||BigInt(p.amount)!==BigInt(amount))throw new ApiError(409,'PAYMENT_MISMATCH','ข้อมูลชำระเงินไม่ตรงกับรายการขาย');
 const fees=p.fees.filter(f=>f.parent_id===paymentId);
 if(new Set(fees.map(f=>f.fee_id)).size!==fees.length)throw new ApiError(502,'INVALID_FEES','ข้อมูลค่าธรรมเนียมไม่ถูกต้อง');
 const fee=fees.reduce((n,f)=>n+BigInt(f.unit_amount)+BigInt(f.percentage_amount),0n);
 if(fee>BigInt(p.amount))throw new ApiError(502,'INVALID_FEES','ค่าธรรมเนียมเกินยอดชำระ');
 return {payment:p,fee:`${fee/100n}.${String(fee%100n).padStart(2,'0')}`};
}
export function createGatewayConfirmation(url:string,key:string,secret:string|undefined,apiKey:string|undefined,hex:string,send:typeof fetch=fetch){
 const db=secret?createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}):null,cipher=snapshotCipher(hex);
 return async(token:string,context:UserContext,sessionId:string,requestId:string)=>{
  if(!db||!apiKey)throw new ApiError(503,'GATEWAY_UNAVAILABLE','Gateway ไม่พร้อมใช้งาน');
  const hash=createHash('sha256').update(sessionId).digest('hex');
  const {data:row,error}=await db.from('reservepay_payment_sessions').select('payment_id,amount_minor,sale_id,checkout_input').eq('session_hash',hash).eq('org_id',context.orgId).eq('user_id',context.userId).maybeSingle();
  if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ตรวจสอบรายการไม่สำเร็จ');
  if(!row?.payment_id)throw new ApiError(404,'NOT_FOUND','ไม่พบรายการชำระเงิน');
  if(!row.sale_id){
   let raw:unknown;
   try{const response=await send('https://api.reservepay.com/merchants/find-payment',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Api-Version':'2025-04-01','Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({payment_id:row.payment_id}),signal:AbortSignal.timeout(8000),redirect:'error'});if(!response.ok)throw new Error();raw=await response.json();}catch{throw new ApiError(503,'PAYMENT_UNKNOWN','ยังยืนยันการชำระเงินไม่ได้ กรุณาตรวจสอบรายการเดิม');}
   const {payment,fee}=verifiedAmounts(raw,row.payment_id,hash,row.amount_minor);
   if(payment.status!=='SUCCESSFUL')return {status:payment.status,expiresAt:payment.expires_at?new Date(payment.expires_at*1000).toISOString():null,serverTime:new Date().toISOString()};
   if(!payment.captured_at||!row.checkout_input)throw new ApiError(409,'PAID_NOT_POSTED','รับเงินแล้ว แต่ข้อมูลตะกร้าไม่พร้อมบันทึก กรุณาตรวจสอบรายการเดิม ห้ามรับเงินซ้ำ');
   const saved=await db.from('reservepay_payment_sessions').update({verified_fee:fee,paid_at:new Date(payment.captured_at*1000).toISOString(),verified_at:new Date().toISOString()}).eq('session_hash',hash).eq('org_id',context.orgId).eq('user_id',context.userId).is('sale_id',null);
   if(saved.error)throw new ApiError(503,'PAID_NOT_POSTED','รับเงินแล้ว แต่ยังบันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบรายการเดิม');
  }
  const completed=await createUserClient(url,key,token).rpc('complete_gateway_sale',{p_hash:hash,p_request:requestId});
  if(completed.error)throw new ApiError(409,'PAID_NOT_POSTED','รับเงินแล้ว แต่ยังออกบิลไม่ได้เนื่องจากข้อมูลราคาหรือสต็อกเปลี่ยน กรุณาตรวจสอบรายการเดิม ห้ามรับเงินซ้ำ');
  const {identityCipher,...sale}=storedSale.parse(completed.data),identity=cipher.decrypt(identityCipher);
  return {status:'SUCCESSFUL',sale:{...sale,receipt:{...sale.receipt,store:{name:identity.storeName},cashierName:identity.cashierName}}};
 };
}
export type GatewayConfirmation=ReturnType<typeof createGatewayConfirmation>;

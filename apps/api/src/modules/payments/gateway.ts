import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {Router} from 'express';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {bearerToken} from '../../middleware/bearer.js';
import type {ResolveIdentity,UserContext} from '../auth/types.js';
import {quoteInput,type QuoteService} from '../sales/quote.js';
import type {PaymentSettingsService} from './service.js';
export const gatewayInput=quoteInput.omit({paymentMethod:true}).extend({sessionId:z.string().regex(/^[A-Za-z0-9_-]{6,200}$/),expectedTotalAmount:z.string().regex(/^\d+\.\d{2}$/)}).strict();
type Binding={session_hash:string;org_id:string;user_id:string;quote_hash:string;amount_minor:string};
export interface GatewayLedger{bind(row:Binding):Promise<void>;}
export function gatewayLedger(url:string,secret:string):GatewayLedger{
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 return {async bind(row){
  const {error}=await db.from('reservepay_payment_sessions').insert(row);
  if(!error)return;
  if(error.code!=='23505')throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถเตรียมรายการชำระเงินได้');
  const saved=await db.from('reservepay_payment_sessions').select('*').eq('session_hash',row.session_hash).single();
  if(saved.error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถตรวจสอบรายการเดิมได้');
  if(Object.entries(row).some(([k,v])=>saved.data[k]!==v))throw new ApiError(409,'PAYMENT_CONFLICT','รายการชำระเงินผูกกับตะกร้าหรือผู้ใช้อื่นแล้ว');
 }};
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function createGatewayService(options:{apiKey?:string;ledger?:GatewayLedger;quote:QuoteService;settings:Pick<PaymentSettingsService,'get'>;returnUrl:string;send?:typeof fetch}){
 return async(token:string,context:UserContext,input:z.infer<typeof gatewayInput>)=>{
  if(!options.apiKey||!options.ledger)throw new ApiError(503,'GATEWAY_UNAVAILABLE','ReservePay ยังไม่พร้อมใช้งาน');
  if((await options.settings.get(token,context)).mode!=='GATEWAY')throw new ApiError(409,'GATEWAY_UNAVAILABLE','ร้านไม่ได้เปิด Payment Gateway');
  const quote=await options.quote(token,{items:input.items,discountAmount:input.discountAmount,paymentMethod:'CASH'});
  if(quote.totalAmount!==input.expectedTotalAmount||BigInt(quote.totalAmount.replace('.',''))<=0n)throw new ApiError(409,'QUOTE_CHANGED','ยอดชำระเปลี่ยนแล้ว กรุณาตรวจสอบตะกร้า');
  const minor=BigInt(quote.totalAmount.replace('.','')).toString(),sessionHash=hash(input.sessionId);
  let remote:unknown;
  try{
   const checked=await (options.send??fetch)('https://api.reservepay.com/sdk/retrieve-payment-session',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Api-Version':'2025-04-01'},body:JSON.stringify({payment_session_id:input.sessionId}),signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!checked.ok)throw new Error();remote=await checked.json();
  }catch{throw new ApiError(503,'SESSION_UNAVAILABLE','ไม่สามารถตรวจสอบ session กับ ReservePay ได้');}
  const verified=z.object({amount:z.union([z.number().int().nonnegative().safe(),z.string().regex(/^\d+$/)]),currency:z.literal('THB'),payment_method:z.literal('PROMPTPAY')}).safeParse(remote);
  if(!verified.success||String(verified.data.amount)!==minor)throw new ApiError(409,'SESSION_MISMATCH','ยอดหรือช่องทางชำระเงินของ session ไม่ตรงกับตะกร้า');
  await options.ledger.bind({session_hash:sessionHash,org_id:context.orgId,user_id:context.userId,quote_hash:hash(JSON.stringify({items:input.items,discount:input.discountAmount,total:quote.totalAmount})),amount_minor:minor});
  let response:Response;
  try{response=await (options.send??fetch)('https://api.reservepay.com/merchants/initiate-payment-flow',{method:'POST',headers:{Authorization:`Bearer ${options.apiKey}`,'Api-Version':'2025-04-01','Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({amount:minor,currency:'THB',payment_session_id:input.sessionId,capture:true,return_url:options.returnUrl,external_id:`pos_${sessionHash}`}),signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw new ApiError(503,'PAYMENT_UNKNOWN','ยังยืนยันการสร้าง QRCode ไม่ได้ กรุณาตรวจสอบรายการเดิมก่อนสร้างใหม่');}
  if(!response.ok){await response.body?.cancel();throw new ApiError(502,'GATEWAY_ERROR',`ReservePay ไม่สามารถเริ่มรายการได้ (HTTP ${response.status})`);}
  await response.body?.cancel();
  return {initiated:true as const};
 };
}
export type GatewayService=ReturnType<typeof createGatewayService>;
export function gatewayRoutes(resolve:ResolveIdentity,service:GatewayService){const router=Router();router.post('/payments/gateway/initiate',async(req,res)=>{
 const token=bearerToken(req.header('Authorization')),context=await resolve(token);
 if(!['OWNER','EMPLOYEE'].includes(context.role))throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์รับชำระเงิน');
 const parsed=gatewayInput.safeParse(req.body);if(!parsed.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลชำระเงินไม่ถูกต้อง');
 res.json({success:true,data:await service(token,context,parsed.data)});
 });return router;}

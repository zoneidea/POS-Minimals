import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {createIdentityResolver} from '../auth/resolver.js';
import type {ResolveIdentity} from '../auth/types.js';
import {createReservePayVoid} from '../payments/reservepay-void.js';
import {createPaymentSettingsService} from '../payments/service.js';
import { createBillService } from './bill-service.js';
import { ApiError } from '../../infra/errors.js';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { saleList,voidResult,type SaleManagementService } from './void-schema.js';
export function createSaleManagementService(url:string,key:string,encryptionKey:string,secret?:string,apiKey?:string,send:typeof fetch=fetch,resolve:ResolveIdentity=createIdentityResolver(url,key)):SaleManagementService{
 const admin=secret?createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}):null;
 const settings=createPaymentSettingsService(url,key,encryptionKey),providerVoid=createReservePayVoid(apiKey,send);
 return {
 async list(token,_context,page){const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());const result=await createBillService(url,key,encryptionKey).list(token,page,{from:today,to:today,groupBy:'day',page});if(result.items.some(s=>s.gatewayPayment)){const enabled=(await settings.get(token,_context)).mode==='GATEWAY';result.items=result.items.map(s=>({...s,gatewayPayment:s.gatewayPayment&&enabled}));}return result;},
 async void(token,id,reason,requestId){
  const user=createUserClient(url,key,token);
  const prepared=await user.rpc('prepare_sale_void',{p_id:id,p_reason:reason,p_request_id:requestId});
  if(prepared.error)throw new ApiError(({PT400:400,PT403:403,PT404:404,PT409:409} as Record<string,number>)[prepared.error.code]??503,prepared.error.message,'ยังยกเลิกรายการไม่ได้: ไม่มีสิทธิ์ ข้ามวัน หรือมีคำขอเดิมกำลังดำเนินการ');
  const attempt=z.object({orgId:z.uuid(),paymentId:z.string().nullable(),amount:z.string().optional(),attemptId:z.uuid().optional(),verified:z.boolean().optional()}).parse(prepared.data);
  if(attempt.paymentId){
   const context=await resolve(token);
   if(!context||context.orgId!==attempt.orgId||context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ยกเลิกรายการ');
   if(!attempt.verified){
    if((await settings.get(token,context)).mode!=='GATEWAY')throw new ApiError(403,'GATEWAY_DISABLED','ร้านไม่ได้เปิด Payment Gateway');
    if(!admin||!apiKey||!attempt.attemptId||!attempt.amount)throw new ApiError(503,'GATEWAY_UNAVAILABLE','Gateway ไม่พร้อมใช้งาน');
    await providerVoid(attempt.paymentId,attempt.amount);
    const proof=await admin.rpc('verify_gateway_void',{p_org:attempt.orgId,p_sale:id,p_attempt:attempt.attemptId,p_payment:attempt.paymentId});
    if(proof.error)throw new ApiError(503,'GATEWAY_VOID_NOT_POSTED','ReservePay ยกเลิกแล้ว แต่ยังคืนสต็อกไม่สำเร็จ กรุณาตรวจสอบรายการเดิม');
   }
  }
  const {data,error}=await createUserClient(url,key,token).rpc('void_sale',{p_id:id,p_reason:reason,p_request_id:requestId});if(error){const codes:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};const messages:Record<string,string>={GATEWAY_VOID_REQUIRES_PROVIDER:'บิล Gateway ต้องยกเลิกผ่านผู้ให้บริการก่อนคืนสต็อก',VOID_WINDOW_EXPIRED:'ยกเลิกการขายข้ามวันไม่ได้',ALREADY_VOIDED:'รายการนี้ถูกยกเลิกแล้วด้วยเหตุผลอื่น',STOCK_LIMIT_EXCEEDED:'คืนสต็อกไม่ได้ เนื่องจากจำนวนเกินขีดจำกัด',NOT_FOUND:'ไม่พบรายการขาย',FORBIDDEN:'ไม่มีสิทธิ์ยกเลิกการขาย'};throw new ApiError(codes[error.code]??503,codes[error.code]?error.message:'SERVICE_UNAVAILABLE',messages[error.message]??'ยังยืนยันผลการยกเลิกไม่ได้ กรุณาตรวจสอบรายการเดิม');}return voidResult.parse(data);}
};}

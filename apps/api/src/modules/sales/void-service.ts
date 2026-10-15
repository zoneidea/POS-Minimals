import { createBillService } from './bill-service.js';
import { ApiError } from '../../infra/errors.js';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { saleList,voidResult,type SaleManagementService } from './void-schema.js';
export function createSaleManagementService(url:string,key:string,encryptionKey:string):SaleManagementService{return {
 async list(token,_context,page){const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());return createBillService(url,key,encryptionKey).list(token,page,{from:today,to:today,groupBy:'day',page});},
 async void(token,id,reason,requestId){const {data,error}=await createUserClient(url,key,token).rpc('void_sale',{p_id:id,p_reason:reason,p_request_id:requestId});if(error){const codes:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};const messages:Record<string,string>={GATEWAY_VOID_REQUIRES_PROVIDER:'บิล Gateway ต้องยกเลิกผ่านผู้ให้บริการก่อนคืนสต็อก',VOID_WINDOW_EXPIRED:'ยกเลิกการขายข้ามวันไม่ได้',ALREADY_VOIDED:'รายการนี้ถูกยกเลิกแล้วด้วยเหตุผลอื่น',STOCK_LIMIT_EXCEEDED:'คืนสต็อกไม่ได้ เนื่องจากจำนวนเกินขีดจำกัด',NOT_FOUND:'ไม่พบรายการขาย',FORBIDDEN:'ไม่มีสิทธิ์ยกเลิกการขาย'};throw new ApiError(codes[error.code]??503,codes[error.code]?error.message:'SERVICE_UNAVAILABLE',messages[error.message]??'ยังยืนยันผลการยกเลิกไม่ได้ กรุณาตรวจสอบรายการเดิม');}return voidResult.parse(data);}
};}

import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
const payment=z.object({payment_id:z.string(),status:z.string(),amount:z.number().int().nonnegative().safe(),currency:z.literal('THB'),payment_method:z.literal('PROMPTPAY')});
/** Reconcile before posting: a timeout may already have voided the original payment. */
export function createReservePayVoid(apiKey:string|undefined,send:typeof fetch=fetch){return async(paymentId:string,amount:string)=>{
 if(!apiKey)throw new ApiError(503,'GATEWAY_UNAVAILABLE','Gateway ไม่พร้อมใช้งาน');
 const call=async(endpoint:string)=>{try{const response=await send(`https://api.reservepay.com/merchants/${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Api-Version':'2025-04-01','Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({payment_id:paymentId}),signal:AbortSignal.timeout(8000),redirect:'error'});if(!response.ok){await response.body?.cancel();throw new Error();}return await response.json() as unknown;}catch{throw new ApiError(503,'GATEWAY_VOID_UNKNOWN','ยังยืนยันการยกเลิกกับ ReservePay ไม่สำเร็จ กรุณาตรวจสอบรายการเดิมก่อนส่งซ้ำ');}};
 const find=async()=>{const result=payment.safeParse(await call('find-payment'));if(!result.success||result.data.payment_id!==paymentId||BigInt(result.data.amount)!==BigInt(amount.replace('.','')))throw new ApiError(502,'PAYMENT_MISMATCH','ข้อมูลการชำระเงินไม่ตรงกับบิล');return result.data.status;};
 const status=await find();if(status==='VOIDED')return;
 if(status!=='SUCCESSFUL')throw new ApiError(409,'PAYMENT_NOT_VOIDABLE','สถานะการชำระเงินไม่สามารถยกเลิกได้');
 if(await call('void-payment')!==true)throw new ApiError(503,'GATEWAY_VOID_UNKNOWN','ReservePay ยังไม่ยืนยันการยกเลิก กรุณาตรวจสอบรายการเดิม');
 if(await find()!=='VOIDED')throw new ApiError(503,'GATEWAY_VOID_UNKNOWN','ยังตรวจสอบผลการยกเลิกไม่ได้ กรุณาตรวจสอบรายการเดิม');
 };}

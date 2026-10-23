import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {guestMenu,guestOrder,guestOrderResult} from '@pos/contracts/restaurant';
import {ApiError} from '../../infra/errors.js';
import {createUserClient} from '../../infra/supabase/user-client.js';
import {signProductImages} from '../products/image-urls.js';
import {cafeMessages} from '../cafe-options/service.js';
const messages:Record<string,string>={INSUFFICIENT_STOCK:'จำนวนอาหารที่เลือกไม่พร้อมขาย กรุณาลดจำนวนหรือติดต่อพนักงาน',...cafeMessages,GUEST_ACCESS_EXPIRED:'QR นี้หมดอายุหรือบิลปิดแล้ว กรุณาติดต่อพนักงาน',RATE_LIMITED:'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง',VERSION_CONFLICT:'มีออเดอร์ใหม่ในโต๊ะ กรุณาตรวจสอบรายการแล้วส่งอีกครั้ง',CART_STALE:'ราคาเมนูเปลี่ยนแล้ว กรุณาตรวจสอบเมนูและเลือกใหม่',ORDER_LIMIT:'บิลนี้มีรายการครบขีดจำกัด กรุณาติดต่อพนักงาน',IDEMPOTENCY_CONFLICT:'ข้อมูลคำขอเดิมไม่ตรงกัน กรุณาติดต่อพนักงาน',NOT_FOUND:'ไม่พบบิลโต๊ะ',BILL_CLOSED:'บิลนี้ปิดแล้ว',VALIDATION_ERROR:'ข้อมูลออเดอร์ไม่ถูกต้อง'};
export function createGuestOrdersService(url:string,key:string,secret:string|undefined,encryptionKey:string,publicUrl:string){
 const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
 const tokenFor=(id:string)=>createHmac('sha256',encryptionKey).update(`pos:restaurant-guest:v1:${id}`).digest('base64url');
 const ready=()=>{if(!secret||!/^[0-9a-f]{64}$/i.test(encryptionKey))throw new ApiError(503,'SERVICE_UNAVAILABLE','ระบบสั่งอาหารผ่าน QR ยังไม่พร้อม');};
 const fail=(code:string)=>{const status=code==='GUEST_ACCESS_EXPIRED'?410:code==='RATE_LIMITED'?429:code==='VALIDATION_ERROR'||code==='INVALID_DISCOUNT'?400:code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:409;throw new ApiError(status,code,messages[code]??'ไม่สามารถส่งออเดอร์ได้ กรุณาตรวจสอบเมนูอีกครั้ง');};
 return {
 async issue(token:string,bill:string,version:number,revoke:boolean,requestId:string){ready();const id=randomUUID(),raw=tokenFor(id);const {data,error}=await createUserClient(url,key,token).rpc('restaurant_issue_guest_access',{p_bill:bill,p_version:version,p_id:id,p_hash:hash(raw),p_revoke:revoke,p_request:requestId});if(error){if(error.code?.startsWith('PT'))fail(error.message);throw new ApiError(503,'SERVICE_UNAVAILABLE','ยังยืนยัน QR ไม่สำเร็จ');}if(revoke)return {revoked:true};const resultToken=tokenFor(data.id);if(hash(resultToken)!==data.hash)throw new ApiError(503,'SERVICE_UNAVAILABLE','กรุณายกเลิก QR เดิมแล้วสร้างใหม่');return {url:new URL('/order/',publicUrl).href+'#'+resultToken,expiresAt:data.expiresAt};},
 async guest(token:string,clientAddress:string,operation:'menu'|'order'|'send',input:unknown,requestId:string){ready();const client=createClient(url,secret!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const {data,error}=await client.rpc('restaurant_guest_request',{p_hash:hash(token),p_client:createHmac('sha256',encryptionKey).update('guest-client:'+clientAddress).digest('hex'),p_operation:operation,p_input:input??{},p_request:requestId});if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ยังยืนยันผลออเดอร์ไม่ได้ กรุณาตรวจสอบคำขอเดิมก่อนส่งซ้ำ');if(!data?.ok)fail(data?.code??'VALIDATION_ERROR');if(operation==='menu'){const paths=data.data.products.flatMap((p:{imagePath?:string})=>p.imagePath?[p.imagePath]:[]),images=await signProductImages(client,paths,token);return guestMenu.parse({...data.data,products:data.data.products.map(({imagePath,...p}:{imagePath:string|null})=>({...p,imageUrl:imagePath?images.get(imagePath)??null:null}))});}return operation==='order'?guestOrder.parse(data.data):guestOrderResult.parse(data.data);}
 };
}
export type GuestOrdersService=ReturnType<typeof createGuestOrdersService>;

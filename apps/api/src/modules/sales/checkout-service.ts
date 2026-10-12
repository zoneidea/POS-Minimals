import { ApiError } from '../../infra/errors.js';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { storedSale,type CheckoutService } from './checkout-schema.js';
import { snapshotCipher } from './snapshot-cipher.js';
export function createCheckoutService(url:string,key:string,encryptionKey:string):CheckoutService {
 const cipher=snapshotCipher(encryptionKey);
 const decode=(raw:unknown)=>{const {identityCipher,...sale}=storedSale.parse(raw),identity=cipher.decrypt(identityCipher);return {...sale,receipt:{...sale.receipt,store:{name:identity.storeName},cashierName:identity.cashierName}};};
 return {
 async commit(token,context,input,idempotencyKey,requestId){
  const {data,error}=await createUserClient(url,key,token).rpc('checkout_cash_sale',{p_input:input,p_key:idempotencyKey,p_request_id:requestId,p_identity_cipher:cipher.encrypt({storeName:context.orgName,cashierName:context.username})});
  if(error){const status:Record<string,number>={PT400:400,PT403:403,PT409:409};const messages:Record<string,string>={CART_STALE:'ราคา ยอด หรือสต็อกเปลี่ยน กรุณาตรวจสอบยอดอีกครั้ง',INSUFFICIENT_STOCK:'สต็อกไม่พอ กรุณากลับไปแก้ตะกร้า',INSUFFICIENT_PAYMENT:'เงินรับไม่ครบยอดขาย',IDEMPOTENCY_CONFLICT:'คำขอนี้เคยใช้แล้ว กรุณาตรวจสอบผลรายการเดิม',PRODUCT_UNAVAILABLE:'สินค้าไม่พร้อมขาย กรุณาแก้ตะกร้า'};throw new ApiError(status[error.code]??503,status[error.code]?error.message:'SERVICE_UNAVAILABLE',messages[error.message]??'ยังยืนยันผลการขายไม่ได้ กรุณาตรวจสอบผลรายการเดิม');}
  return decode(data);
 },
 async recover(token,context,idempotencyKey){const {data,error}=await createUserClient(url,key,token).from('sales').select('result_json').eq('org_id',context.orgId).eq('request_key',idempotencyKey).maybeSingle();if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ตรวจสอบผลการขายไม่สำเร็จ');if(!data)throw new ApiError(404,'NOT_FOUND','ยังไม่พบรายการขาย');return {...decode(data.result_json),replayed:true};}
 };
}

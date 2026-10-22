import {restaurantBoard,restaurantBill} from '@pos/contracts/restaurant';
import {createUserClient} from '../../infra/supabase/user-client.js';
import {ApiError} from '../../infra/errors.js';
import {snapshotCipher} from '../sales/snapshot-cipher.js';
import {storedSale} from '../sales/checkout-schema.js';
import {cafeMessages} from '../cafe-options/service.js';
import type {UserContext} from '../auth/types.js';
const messages:Record<string,string>={...cafeMessages,RESTAURANT_MODE_REQUIRED:'ร้านนี้ไม่ได้เปิดโหมดร้านอาหาร',OPEN_RESTAURANT_BILLS:'กรุณาปิดบิลทุกโต๊ะก่อนเปลี่ยนโหมดร้าน',VERSION_CONFLICT:'บิลมีการเปลี่ยนแปลง กรุณาตรวจสอบข้อมูลล่าสุด',TABLE_IN_USE:'โต๊ะนี้มีบิลเปิดอยู่',TABLE_NAME_EXISTS:'ชื่อโต๊ะนี้มีอยู่แล้ว',TABLE_LIMIT:'รองรับได้สูงสุด 100 โต๊ะ',ORDER_LIMIT:'บิลนี้มีรายการครบขีดจำกัดแล้ว',BILL_CLOSED:'บิลนี้ปิดแล้ว กรุณาตรวจสอบรายการขาย',EMPTY_BILL:'บิลยังไม่มีรายการอาหาร',BILL_HAS_ORDERS:'กรุณาให้เจ้าของยกเลิกออเดอร์พร้อมเหตุผลก่อนปิดโต๊ะ',INSUFFICIENT_STOCK:'สต็อกไม่พอสำหรับปิดบิล กรุณาตรวจสอบรายการ',INSUFFICIENT_PAYMENT:'เงินรับไม่ครบยอดบิล',CART_STALE:'ยอดบิลเปลี่ยนแล้ว กรุณาตรวจสอบอีกครั้ง',IDEMPOTENCY_CONFLICT:'รหัสคำขอนี้ถูกใช้กับรายการอื่นแล้ว'};
export function createRestaurantService(url:string,key:string,encryptionKey:string){
 const cipher=snapshotCipher(encryptionKey);
 const check=(error:{code?:string;message?:string}|null)=>{if(!error)return;const status:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};throw new ApiError(status[error.code??'']??503,status[error.code??'']?error.message??'CONFLICT':'SERVICE_UNAVAILABLE',messages[error.message??'']??'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบรายการเดิมก่อนทำซ้ำ');};
 const rpc=async(token:string,name:string,args:Record<string,unknown>={})=>{const {data,error}=await createUserClient(url,key,token).rpc(name,args);check(error);return data;};
 const decode=(raw:unknown)=>{const {identityCipher,...sale}=storedSale.parse(raw),identity=cipher.decrypt(identityCipher);return {...sale,receipt:{...sale.receipt,store:{name:identity.storeName},cashierName:identity.cashierName}};};
 return {
  async board(token:string){return restaurantBoard.parse(await rpc(token,'restaurant_board'));},
  async saveTable(token:string,id:string|null,input:unknown,request:string){return rpc(token,'restaurant_save_table',{p_id:id,p_input:input,p_request:request});},
  async open(token:string,id:string,key:string,request:string){return restaurantBill.parse(await rpc(token,'restaurant_open_bill',{p_table:id,p_key:key,p_request:request}));},
  async send(token:string,id:string,input:{version:number;key:string;items:unknown[]},request:string){return restaurantBill.parse(await rpc(token,'restaurant_send_round',{p_bill:id,p_version:input.version,p_key:input.key,p_items:input.items,p_request:request}));},
  async cancelRound(token:string,id:string,round:string,version:number,reason:string,request:string){return restaurantBill.parse(await rpc(token,'restaurant_cancel_round',{p_bill:id,p_round:round,p_version:version,p_reason:reason,p_request:request}));},
  async cancelBill(token:string,id:string,version:number,request:string){return restaurantBill.parse(await rpc(token,'restaurant_cancel_bill',{p_bill:id,p_version:version,p_request:request}));},
  async cash(token:string,context:UserContext,id:string,input:{version:number;key:string;receivedAmount:string;totalAmount:string},request:string){return decode(await rpc(token,'restaurant_checkout_cash',{p_bill:id,p_version:input.version,p_key:input.key,p_received:input.receivedAmount,p_total:input.totalAmount,p_request:request,p_identity_cipher:cipher.encrypt({storeName:context.orgName,cashierName:context.username})}));},
  async recover(token:string,context:UserContext,id:string){const {data,error}=await createUserClient(url,key,token).from('restaurant_bills').select('result_json').eq('org_id',context.orgId).eq('id',id).eq('status','CLOSED').maybeSingle();check(error);if(!data?.result_json)throw new ApiError(404,'NOT_FOUND','ยังไม่พบรายการรับเงินของบิลนี้');return {...decode(data.result_json),replayed:true};}
 };
}
export type RestaurantService=ReturnType<typeof createRestaurantService>;

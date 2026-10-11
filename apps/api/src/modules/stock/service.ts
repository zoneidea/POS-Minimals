import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { productResult } from '../products/schema.js';
import { movementResult,type StockService } from './schema.js';
export function createStockService(url:string,key:string):StockService {
 return {
 async adjust(token,id,input,idempotencyKey,requestId){
  const {data,error}=await createUserClient(url,key,token).rpc('adjust_product_stock',{p_id:id,p_delta:input.delta,p_reason:input.reason,p_expected_version:input.expectedVersion,p_key:idempotencyKey,p_request_id:requestId});
  if(error){const statuses:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};const messages:Record<string,string>={PRODUCT_VERSION_CONFLICT:'สต็อกเปลี่ยนแปลงแล้ว กรุณาปิดหน้าต่างและโหลดรายการใหม่',INSUFFICIENT_STOCK:'จำนวนคงเหลือหลังปรับต้องไม่ติดลบ',STOCK_LIMIT_EXCEEDED:'จำนวนสต็อกเกินขอบเขตที่รองรับ',IDEMPOTENCY_CONFLICT:'คำขอนี้ใช้บันทึกแล้ว กรุณาปิดหน้าต่างและตรวจสอบสต็อกล่าสุด'};throw new ApiError(statuses[error.code]??503,statuses[error.code]?error.message:'SERVICE_UNAVAILABLE',messages[error.message]??'ปรับสต็อกไม่สำเร็จ');}
  return productResult.parse(data);
 },
 async history(token,context,query){
  const client=createUserClient(url,key,token);
  let list=client.from('stock_movements').select('id,product_id,product_name_snapshot,barcode_snapshot,quantity_delta,quantity_before,quantity_after,reason,performed_by,created_at',{count:'exact'}).eq('org_id',context.orgId);
  if(query.productId)list=list.eq('product_id',query.productId);
  const {data,error,count}=await list.order('created_at',{ascending:false}).order('id',{ascending:false}).range((query.page-1)*query.limit,query.page*query.limit-1);
  if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','โหลดประวัติสต็อกไม่สำเร็จ');
  const actors=[...new Set((data??[]).map(row=>String(row.performed_by)))];
  const names=new Map<string,string>();
  if(actors.length){const members=await client.from('organization_members').select('user_id,display_username').eq('org_id',context.orgId).in('user_id',actors);if(members.error)throw new ApiError(503,'SERVICE_UNAVAILABLE','โหลดผู้ปรับสต็อกไม่สำเร็จ');for(const row of members.data??[])names.set(String(row.user_id),String(row.display_username));}
  return {items:(data??[]).map(row=>movementResult.parse({id:row.id,productId:row.product_id,productName:row.product_name_snapshot,barcode:row.barcode_snapshot,delta:row.quantity_delta,before:row.quantity_before,after:row.quantity_after,reason:row.reason,actorUserId:row.performed_by,actorUsername:names.get(String(row.performed_by))??null,updatedAt:row.created_at})),total:count??0,page:query.page,limit:query.limit};
 }
 };
}

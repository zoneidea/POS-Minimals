import { signProductImages } from './image-service.js';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { productResult,type ProductService } from './schema.js';
export function createProductService(url:string,key:string):ProductService {
 return {
 async list(token,context,page,limit){
  const client=createUserClient(url,key,token);
  const {data,error,count}=await client.from('products').select('id,category_id,barcode,name,sale_price,unit_cost,quantity_on_hand,row_version,image_path',{count:'exact'}).eq('org_id',context.orgId).is('deleted_at',null).order('name').order('id').range((page-1)*limit,page*limit-1);
  if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','โหลดสินค้าไม่สำเร็จ');
  const images=await signProductImages(client,(data??[]).flatMap(row=>row.image_path?[String(row.image_path)]:[]));
  return {items:(data??[]).map(row=>productResult.parse({id:row.id,categoryId:row.category_id,barcode:row.barcode,name:row.name,salePrice:Number(row.sale_price).toFixed(2),unitCost:Number(row.unit_cost).toFixed(2),quantity:row.quantity_on_hand,version:row.row_version,imagePath:row.image_path,imageUrl:images.get(String(row.image_path))??null})),total:count??0,page,limit};
 },
 async mutate(token,operation,id,input,expectedVersion,requestId){
  const {data,error}=await createUserClient(url,key,token).rpc('manage_product',{p_operation:operation,p_id:id,p_barcode:input?.barcode??null,p_name:input?.name??null,p_category_id:input?.categoryId??null,p_sale_price:input?.salePrice??null,p_unit_cost:input?.unitCost??null,p_expected_version:expectedVersion,p_request_id:requestId});
  if(error){const statuses:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};const messages:Record<string,string>={BARCODE_EXISTS:'บาร์โค้ดนี้เคยใช้แล้ว กรุณาใช้บาร์โค้ดอื่น',PRODUCT_VERSION_CONFLICT:'สินค้าเปลี่ยนแปลงแล้ว กรุณาปิดหน้าต่างและโหลดรายการใหม่',CATEGORY_UNAVAILABLE:'หมวดหมู่ไม่มีอยู่หรือถูกลบแล้ว'};throw new ApiError(statuses[error.code]??503,statuses[error.code]?error.message:'SERVICE_UNAVAILABLE',messages[error.message]??'ดำเนินการกับสินค้าไม่สำเร็จ');}
  return productResult.parse(data);
 }
 };
}

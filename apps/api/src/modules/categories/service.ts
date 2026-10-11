import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { categoryResult,type CategoryService } from './schema.js';
export function createCategoryService(url:string,key:string):CategoryService {
 return {
 async list(token,context,page,limit){const {data,error,count}=await createUserClient(url,key,token).from('categories').select('id,name,sort_order',{count:'exact'}).eq('org_id',context.orgId).is('deleted_at',null).order('sort_order').order('name').order('id').range((page-1)*limit,page*limit-1);if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','โหลดหมวดหมู่ไม่สำเร็จ');return {items:(data??[]).map(row=>categoryResult.parse({id:row.id,name:row.name,sortOrder:row.sort_order})),total:count??0,page,limit};},
 async mutate(token,_context,operation,id,name,requestId){const {data,error}=await createUserClient(url,key,token).rpc('manage_category',{p_operation:operation,p_id:id,p_name:name,p_request_id:requestId});if(error){const messages:Record<string,string>={CATEGORY_NAME_EXISTS:'ชื่อหมวดหมู่นี้มีอยู่แล้ว',CATEGORY_IN_USE:'ไม่สามารถลบหมวดหมู่ที่มีสินค้าใช้งานอยู่'};const statuses:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};throw new ApiError(statuses[error.code]??503,error.code==='PT409'?error.message:'CATEGORY_ERROR',messages[error.message]??'ดำเนินการกับหมวดหมู่ไม่สำเร็จ');}return categoryResult.parse(data);}
 };
}

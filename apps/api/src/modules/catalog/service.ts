import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { catalogResult,type CatalogService } from './schema.js';
export function createCatalogService(url:string,key:string):CatalogService {
 return {async list(token,query){
  const {data,error}=await createUserClient(url,key,token).rpc('list_pos_products',{p_page:query.page,p_limit:query.limit,p_search:query.search,p_barcode:query.barcode??null,p_category_id:query.categoryId??null});
  if(error)throw new ApiError(error.code==='PT403'?403:503,error.code==='PT403'?'FORBIDDEN':'SERVICE_UNAVAILABLE','โหลดสินค้าหน้าขายไม่สำเร็จ');
  return catalogResult.parse(data);
 }};
}

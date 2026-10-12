import { signProductImages } from '../products/image-service.js';
import { z } from 'zod';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { catalogResult,type CatalogService } from './schema.js';
export function createCatalogService(url:string,key:string):CatalogService {
 return {async list(token,query){
  const client=createUserClient(url,key,token);
  const {data,error}=await client.rpc('list_pos_products',{p_page:query.page,p_limit:query.limit,p_search:query.search,p_barcode:query.barcode??null,p_category_id:query.categoryId??null});
  if(error)throw new ApiError(error.code==='PT403'?403:503,error.code==='PT403'?'FORBIDDEN':'SERVICE_UNAVAILABLE','โหลดสินค้าหน้าขายไม่สำเร็จ');
  const raw=z.object({items:z.array(z.object({imagePath:z.string().nullable().optional().default(null)}).passthrough()),total:z.number(),page:z.number(),limit:z.number()}).parse(data);
  const images=await signProductImages(client,raw.items.flatMap(row=>row.imagePath?[row.imagePath]:[]));
  return catalogResult.parse({...raw,items:raw.items.map(({imagePath,...row})=>({...row,imageUrl:imagePath?images.get(imagePath)??null:null}))});
 }};
}

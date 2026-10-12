import { randomUUID } from 'node:crypto';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import type { UserContext } from '../auth/types.js';
import { productResult,type Product } from './schema.js';
import { normalizeProductImage } from './image.js';
export const PRODUCT_IMAGE_BUCKET='product-images';
export async function signProductImages(client:ReturnType<typeof createUserClient>,paths:string[]){
 const unique=[...new Set(paths)];if(!unique.length)return new Map<string,string>();
 const {data,error}=await client.storage.from(PRODUCT_IMAGE_BUCKET).createSignedUrls(unique,900);
 if(error)return new Map<string,string>();
 return new Map((data??[]).filter(row=>row.path&&row.signedUrl).map(row=>[row.path!,row.signedUrl]));
}
export type UploadProductImage=(token:string,context:UserContext,id:string,version:number,bytes:Buffer,mime:string,requestId:string)=>Promise<Product>;
export function createImageUploadService(url:string,key:string):UploadProductImage{return async(token,context,id,version,bytes,mime,requestId)=>{
 const client=createUserClient(url,key,token);
 const {data:product,error:lookup}=await client.from('products').select('id,row_version').eq('org_id',context.orgId).eq('id',id).is('deleted_at',null).maybeSingle();
 if(lookup)throw new ApiError(503,'SERVICE_UNAVAILABLE','ตรวจสอบสินค้าไม่สำเร็จ');if(!product)throw new ApiError(404,'NOT_FOUND','ไม่พบสินค้า');
 if(Number(product.row_version)!==version)throw new ApiError(409,'PRODUCT_VERSION_CONFLICT','สินค้าเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่');
 const normalized=await normalizeProductImage(bytes,mime),path=`${context.orgId}/${id}/${randomUUID()}.webp`;
 const {error:upload}=await client.storage.from(PRODUCT_IMAGE_BUCKET).upload(path,normalized,{contentType:'image/webp',upsert:false});
 if(upload)throw new ApiError(503,'IMAGE_UPLOAD_FAILED',/policy|permission|security/i.test(upload.message)?'Storage ยังไม่ได้ตั้งค่าสิทธิ์รูปสินค้า กรุณาให้เจ้าของโปรเจกต์ตั้งค่า':'อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง');
 const {data,error}=await client.rpc('set_product_image',{p_id:id,p_path:path,p_expected_version:version,p_request_id:requestId});
 if(error)throw new ApiError(error.code==='PT409'?409:503,error.code==='PT409'?'PRODUCT_VERSION_CONFLICT':'IMAGE_ATTACH_FAILED','ข้อมูลสินค้าบันทึกแล้ว แต่แนบรูปไม่สำเร็จ กรุณาโหลดสินค้าและลองอีกครั้ง');
 const signed=await signProductImages(client,[path]);return productResult.parse({...data,imageUrl:signed.get(path)??null});
};}

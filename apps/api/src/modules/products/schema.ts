import { z } from 'zod';
import type { UserContext } from '../auth/types.js';
export const money=z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/);
export const productInput=z.object({barcode:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(200),categoryId:z.uuid().nullable(),salePrice:money,unitCost:money}).strict();
export const productCreate=productInput.extend({initialQuantity:z.number().int().min(0).max(2147483647).optional()});
export const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const productUpdate=productInput.extend({expectedVersion:version});
export const productDelete=z.object({expectedVersion:version}).strict();
export const productResult=z.object({id:z.uuid(),categoryId:z.uuid().nullable(),barcode:z.string(),name:z.string(),salePrice:money,unitCost:money,quantity:z.number().int().nonnegative(),version,imagePath:z.string().nullable(),imageUrl:z.url().nullable().optional()});
export const productQuery=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(10)}).strict();
export type Product=z.infer<typeof productResult>;
export type ProductInput=z.infer<typeof productCreate>;
export interface ProductService {
 list(token:string,context:UserContext,page:number,limit:number):Promise<{items:Product[];total:number;page:number;limit:number}>;
 mutate(token:string,operation:'create'|'update'|'delete',id:string|null,input:ProductInput|null,expectedVersion:number|null,requestId:string):Promise<Product>;
}

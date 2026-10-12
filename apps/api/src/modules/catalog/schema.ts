import { z } from 'zod';
export const catalogQuery=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(10),search:z.string().trim().max(200).default(''),barcode:z.string().trim().min(1).max(100).optional(),categoryId:z.uuid().optional()}).strict();
export const catalogProduct=z.object({id:z.uuid(),name:z.string(),barcode:z.string(),categoryId:z.uuid().nullable(),salePrice:z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/),quantityOnHand:z.number().int().nonnegative(),rowVersion:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),imageUrl:z.url().nullable()}).strict();
export const catalogResult=z.object({items:z.array(catalogProduct),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.number().int().positive()}).strict();
export interface CatalogService {list(token:string,query:z.infer<typeof catalogQuery>):Promise<z.infer<typeof catalogResult>>}

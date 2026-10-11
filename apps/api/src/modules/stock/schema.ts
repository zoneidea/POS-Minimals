import { z } from 'zod';
import type { UserContext } from '../auth/types.js';
import { version,type Product } from '../products/schema.js';
export const stockInput=z.object({delta:z.number().int().min(-2147483647).max(2147483647).refine(value=>value!==0),reason:z.string().trim().min(1).max(500),expectedVersion:version}).strict();
export const historyQuery=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(10),productId:z.uuid().optional()}).strict();
export const movementResult=z.object({id:z.uuid(),productId:z.uuid(),productName:z.string(),barcode:z.string(),delta:z.number().int(),before:z.number().int().nonnegative(),after:z.number().int().nonnegative(),reason:z.string(),actorUserId:z.uuid(),actorUsername:z.string().nullable(),updatedAt:z.iso.datetime({offset:true})});
export type StockInput=z.infer<typeof stockInput>;
export type Movement=z.infer<typeof movementResult>;
export interface StockService {
 adjust(token:string,id:string,input:StockInput,key:string,requestId:string):Promise<Product>;
 history(token:string,context:UserContext,query:z.infer<typeof historyQuery>):Promise<{items:Movement[];total:number;page:number;limit:number}>;
}

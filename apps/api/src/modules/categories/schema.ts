import { z } from 'zod';
import type { UserContext } from '../auth/types.js';
export const categoryInput=z.object({name:z.string().trim().min(1).max(120)}).strict();
export const categoryResult=z.object({id:z.uuid(),name:z.string(),sortOrder:z.number().int()});
export type Category= z.infer<typeof categoryResult>;
export type CategoryOperation='create'|'update'|'delete';
export interface CategoryService {
 list(token:string,context:UserContext,page:number,limit:number):Promise<{items:Category[];total:number;page:number;limit:number}>;
 mutate(token:string,context:UserContext,operation:CategoryOperation,id:string|null,name:string|null,requestId:string):Promise<Category>;
}

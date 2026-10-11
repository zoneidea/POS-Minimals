import { z } from 'zod';
import { auth,request } from '../../lib/client';
import { TABLE_PAGE_SIZE } from '../../components/DataTable';
import type { components } from '../../../../../packages/contracts/src/generated';
export type CatalogProduct=components['schemas']['Product'];
const item=z.object({id:z.uuid(),name:z.string(),barcode:z.string(),categoryId:z.uuid().nullable(),salePrice:z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/),quantityOnHand:z.number().int().nonnegative(),rowVersion:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),imageUrl:z.null()}).strict();
const result=z.object({items:z.array(item),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.number().int().positive()});
export async function listCatalog(page:number,search:string,barcode:string,signal?:AbortSignal){
 const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');
 const query=new URLSearchParams({page:String(page),limit:String(TABLE_PAGE_SIZE)});if(search)query.set('search',search);if(barcode)query.set('barcode',barcode);
 return result.parse(await request(`/products?${query}`,data.session.access_token,undefined,signal));
}

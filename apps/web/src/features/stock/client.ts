import { z } from 'zod';
import { auth,request } from '../../lib/client';
import { TABLE_PAGE_SIZE } from '../../components/DataTable';
import type { components } from '../../../../../packages/contracts/src/generated';
export type StockMovement=components['schemas']['StockMovement'];
const item=z.object({id:z.uuid(),productId:z.uuid(),productName:z.string(),barcode:z.string(),delta:z.number().int(),before:z.number().int().nonnegative(),after:z.number().int().nonnegative(),reason:z.string(),actorUserId:z.uuid(),actorUsername:z.string().nullable(),updatedAt:z.iso.datetime({offset:true})});
const history=z.object({items:z.array(item),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.number().int().positive()});
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export async function adjustStock(id:string,delta:number,reason:string,expectedVersion:number,key:string){await request(`/inventory/products/${id}/adjust-stock`,await token(),{delta,reason,expectedVersion},undefined,'POST',key);}
export async function stockHistory(page:number,productId?:string,signal?:AbortSignal){return history.parse(await request(`/inventory/stock-movements?page=${page}&limit=${TABLE_PAGE_SIZE}${productId?`&productId=${productId}`:''}`,await token(),undefined,signal));}

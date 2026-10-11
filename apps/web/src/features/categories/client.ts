import { z } from 'zod';
import { TABLE_PAGE_SIZE } from '../../components/DataTable';
import { auth, request } from '../../lib/client';
import type { components } from '../../../../../packages/contracts/src/generated';
export type Category=components['schemas']['Category'];
const item=z.object({id:z.uuid(),name:z.string(),sortOrder:z.number().int()});
const page=z.object({items:z.array(item),total:z.number().int().nonnegative(),page:z.number().int(),limit:z.number().int()});
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export async function listCategories(number:number,signal?:AbortSignal){return page.parse(await request(`/categories?page=${number}&limit=${TABLE_PAGE_SIZE}`,await token(),undefined,signal));}
export async function saveCategory(name:string,id?:string){return item.parse(await request(id?`/categories/${id}`:'/categories',await token(),{name},undefined,id?'PATCH':'POST'));}
export async function deleteCategory(id:string){return item.parse(await request(`/categories/${id}`,await token(),undefined,undefined,'DELETE'));}

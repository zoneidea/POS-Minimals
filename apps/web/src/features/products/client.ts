import { z } from 'zod';
import type { components } from '../../../../../packages/contracts/src/generated';
import { auth,request } from '../../lib/client';
import { TABLE_PAGE_SIZE } from '../../components/DataTable';
export type Product=components['schemas']['InventoryProductRecord'];
export type ProductInput=components['schemas']['ProductInput'];
const money=z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/);
const item=z.object({id:z.uuid(),barcode:z.string(),name:z.string(),categoryId:z.uuid().nullable(),salePrice:money,unitCost:money,quantity:z.number().int().nonnegative(),version:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),imagePath:z.string().nullable()});
const result=z.object({items:z.array(item),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.number().int().positive()});
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export async function listProducts(page:number,signal?:AbortSignal){return result.parse(await request(`/inventory/products?page=${page}&limit=${TABLE_PAGE_SIZE}`,await token(),undefined,signal));}
export async function saveProduct(input:ProductInput,product?:Product){return item.parse(await request(product?`/inventory/products/${product.id}`:'/inventory/products',await token(),product?{...input,expectedVersion:product.version}:input,undefined,product?'PATCH':'POST'));}
export async function deleteProduct(product:Product){return item.parse(await request(`/inventory/products/${product.id}`,await token(),{expectedVersion:product.version},undefined,'DELETE'));}

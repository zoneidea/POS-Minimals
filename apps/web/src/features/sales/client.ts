import { auth,request } from '../../lib/client';
import { saleList,voidResult } from './schema';
import type { components } from '../../../../../packages/contracts/src/generated';
export type SaleSummary=components['schemas']['SaleSummary'];
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export async function listSales(page:number,signal?:AbortSignal){return saleList.parse(await request(`/sales?page=${page}`,await token(),undefined,signal));}
export async function voidSale(id:string,reason:string){return voidResult.parse(await request(`/sales/${id}/void`,await token(),{reason}));}

import { z } from 'zod';
import { completedSaleSchema } from '../pos/checkout-client';
import { queryString } from '../reports/client';
import type { ReportQuery } from '../reports/schema';
import { auth,request } from '../../lib/client';
import { saleList,voidResult } from './schema';

export type SaleSummary=z.infer<typeof saleList>['items'][number];
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export async function listSales(page:number,signal?:AbortSignal){return saleList.parse(await request(`/sales?page=${page}`,await token(),undefined,signal));}
export async function voidSale(id:string,reason:string){return voidResult.parse(await request(`/sales/${id}/void`,await token(),{reason}));}

const billSchema=z.object({status:z.enum(['COMPLETED','VOIDED']),voidedAtUtc:z.string().nullable(),voidReason:z.string().nullable(),sale:completedSaleSchema});
export type Bill=z.infer<typeof billSchema>;
export async function getBill(id:string,signal?:AbortSignal){return billSchema.parse(await request(`/sales/${id}/receipt`,await token(),undefined,signal));}
export async function listReportBills(query:ReportQuery,period:string,signal?:AbortSignal){const params=queryString(query);params.set('period',period);return saleList.parse(await request(`/sales/bills?${params}`,await token(),undefined,signal));}

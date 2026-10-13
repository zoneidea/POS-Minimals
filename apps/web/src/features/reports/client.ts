import { auth,request,RequestError } from '../../lib/client';
import { reportResult,dashboardResult,cashiersResult,rankingsResult,type ReportQuery } from './schema';
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return data.session.access_token;}
export function queryString(query:ReportQuery){const params=new URLSearchParams({groupBy:query.groupBy,page:String(query.page)});if(query.from)params.set('from',query.from);if(query.to)params.set('to',query.to);if(query.cashierId)params.set('cashierId',query.cashierId);return params;}
export async function getReport(type:string,query:ReportQuery,signal?:AbortSignal){return reportResult.parse(await request(`/reports/${type}?${queryString(query)}`,await token(),undefined,signal));}
export async function getDashboard(signal?:AbortSignal){return dashboardResult.parse(await request('/dashboard/summary?includeTopProducts=false',await token(),undefined,signal));}
export async function getCashiers(signal?:AbortSignal){return cashiersResult.parse(await request('/reports/cashiers',await token(),undefined,signal));}
export async function exportReport(type:string,query:ReportQuery){const response=await fetch(`/api/v1/reports/${type}/export.xlsx?${queryString(query)}`,{headers:{Authorization:`Bearer ${await token()}`}});if(!response.ok){const result=await response.json();throw new RequestError(result.error?.message??'ส่งออกไม่สำเร็จ',response.status);}const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`${type}-report.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function displayMoney(value:string){const [integer,decimals]=value.split('.');return `${BigInt(integer??'0').toLocaleString('th-TH')}.${decimals??'00'}`;}

export async function getProductRankings(days:number,signal?:AbortSignal){return rankingsResult.parse(await request(`/dashboard/product-rankings?days=${days}`,await token(),undefined,signal));}

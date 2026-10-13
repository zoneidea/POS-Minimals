import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { reportResult,dashboardResult,cashiersResult,rankingsResult,reportRange,type ReportQuery } from './schema.js';
export function createReportsService(url:string,key:string){const check=(error:{code?:string}|null)=>{if(error)throw new ApiError(error.code==='PT403'?403:503,error.code==='PT403'?'FORBIDDEN':'SERVICE_UNAVAILABLE','โหลดรายงานไม่สำเร็จ');};return {
 async report(token:string,type:string,query:ReportQuery,limit=10){const range=reportRange(query);if(!range)throw new ApiError(400,'INVALID_DATE_RANGE','ช่วงวันที่ต้องไม่เกิน 366 วัน และวันสิ้นสุดต้องไม่น้อยกว่าวันเริ่ม');const {data,error}=await createUserClient(url,key,token).rpc('report_data',{p_type:type,p_from:range.from,p_to:range.to,p_group:query.groupBy,p_cashier:query.cashierId??null,p_page:limit===10?query.page:1,p_limit:limit});check(error);return reportResult.parse(data);},
 async rankings(token:string,days:number){const {data,error}=await createUserClient(url,key,token).rpc('dashboard_product_rankings',{p_days:days});check(error);return rankingsResult.parse(data);},
 async dashboard(token:string){const {data,error}=await createUserClient(url,key,token).rpc('dashboard_summary');check(error);return dashboardResult.parse(data);},
 async cashiers(token:string){const {data,error}=await createUserClient(url,key,token).rpc('report_cashiers');check(error);return cashiersResult.parse(data);}
};}
export type ReportsService=ReturnType<typeof createReportsService>;

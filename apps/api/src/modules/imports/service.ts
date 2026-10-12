import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import type { ImportRow } from './workbook.js';
export interface ImportBatch {batchId:string;expiresAt:string;rows:ImportRow[];errors:{row:number;message:string}[];status:'READY'|'INVALID'|'COMMITTED';importedCount:number}
export interface ImportService {preview(token:string,rows:ImportRow[],errors:ImportBatch['errors'],requestId:string):Promise<ImportBatch>;commit(token:string,id:string,requestId:string):Promise<ImportBatch>;get(token:string,id:string):Promise<ImportBatch>}
export function createImportService(url:string,key:string):ImportService{
 async function call(token:string,args:Record<string,unknown>){const {data,error}=await createUserClient(url,key,token).rpc('inventory_import',args);if(error){const status:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409,PT422:422};throw new ApiError(status[error.code]??503,status[error.code]?error.message:'SERVICE_UNAVAILABLE',error.code==='PT409'?'ข้อมูลเปลี่ยนหลัง Preview หรือ batch หมดอายุ กรุณาตรวจไฟล์ใหม่':'ดำเนินการนำเข้าไม่สำเร็จ');}return data as ImportBatch;}
 return {preview:(token,rows,errors,requestId)=>call(token,{p_operation:'preview',p_id:null,p_rows:rows,p_errors:errors,p_request_id:requestId}),commit:(token,id,requestId)=>call(token,{p_operation:'commit',p_id:id,p_rows:null,p_errors:null,p_request_id:requestId}),get:(token,id)=>call(token,{p_operation:'get',p_id:id,p_rows:null,p_errors:null,p_request_id:null})};
}

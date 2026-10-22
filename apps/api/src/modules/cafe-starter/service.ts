import {cafeStarterStatus,cafeStarterResult} from '@pos/contracts/cafe-options';
import {createUserClient} from '../../infra/supabase/user-client.js';
import {ApiError} from '../../infra/errors.js';
export function createCafeStarterService(url:string,key:string){
 const check=(error:{code?:string;message?:string}|null)=>{if(!error)return;const statuses:Record<string,number>={PT400:400,PT403:403,PT409:409};throw new ApiError(statuses[error.code??'']??503,statuses[error.code??'']?error.message??'CONFLICT':'SERVICE_UNAVAILABLE',error.message==='CAFE_MODE_REQUIRED'?'ชุดข้อมูลตั้งต้นใช้ได้เฉพาะโหมดคาเฟ่':error.message==='OPTION_GROUP_LIMIT'?'จำนวนกลุ่มตัวเลือกเกินขีดจำกัด กรุณาตรวจสอบก่อนนำเข้า':'ไม่สามารถจัดการข้อมูลตั้งต้นได้ กรุณาตรวจสอบสถานะก่อนทำซ้ำ');};
 return {
  async read(token:string){const {data,error}=await createUserClient(url,key,token).rpc('cafe_starter_status');check(error);return cafeStarterStatus.parse(data);},
  async mutate(token:string,action:'APPLY'|'SKIP'|'CLEAR',requestId:string){const {data,error}=await createUserClient(url,key,token).rpc('manage_cafe_starter',{p_action:action,p_request:requestId});check(error);return cafeStarterResult.parse(data);}
 };
}
export type CafeStarterService=ReturnType<typeof createCafeStarterService>;

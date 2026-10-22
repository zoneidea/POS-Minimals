import {cafeConfiguration} from '@pos/contracts/cafe-options';
import {createUserClient} from '../../infra/supabase/user-client.js';
import {ApiError} from '../../infra/errors.js';
export const cafeMessages:Record<string,string>={OPTION_SELECTION_REQUIRED:'กรุณาเลือกตัวเลือกเมนูให้ครบตามกำหนด',OPTION_UNAVAILABLE:'ตัวเลือกหรือท็อปปิ้งไม่พร้อมใช้งาน กรุณาเลือกใหม่',CAFE_MODE_REQUIRED:'กรุณาเปิดโหมดคาเฟ่เพื่อใช้งานตัวเลือกเมนู',INVALID_OPTION_LIMIT:'จำนวนตัวเลือกหรือค่าเริ่มต้นไม่ถูกต้อง',VERSION_CONFLICT:'ข้อมูลตัวเลือกเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด',OPTION_CONFLICT:'ข้อมูลตัวเลือกไม่ถูกต้อง กรุณาเปิดข้อมูลล่าสุด'};
export function createCafeOptionsService(url:string,key:string){
 const check=(error:{code?:string;message?:string}|null)=>{if(!error)return;const statuses:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};throw new ApiError(statuses[error.code??'']??503,statuses[error.code??'']?error.message??'CONFLICT':'SERVICE_UNAVAILABLE',cafeMessages[error.message??'']??'ไม่สามารถโหลดหรือบันทึกตัวเลือกเมนูได้');};
 return {async read(token:string,management=false){const {data,error}=await createUserClient(url,key,token).rpc('cafe_option_configuration',{p_management:management});check(error);return cafeConfiguration.parse(data);},async save(token:string,id:string|null,input:unknown,version:number|null,requestId:string){const {data,error}=await createUserClient(url,key,token).rpc('save_cafe_option_group',{p_id:id,p_input:input,p_version:version,p_request:requestId});check(error);return data;}};
}
export type CafeOptionsService=ReturnType<typeof createCafeOptionsService>;

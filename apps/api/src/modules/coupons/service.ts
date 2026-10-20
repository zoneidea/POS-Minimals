import {createUserClient} from '../../infra/supabase/user-client.js';
import {ApiError} from '../../infra/errors.js';
import type {UserContext} from '../auth/types.js';
import {couponList,couponReport,couponSchema,entitlementsSchema} from './schema.js';
export const couponMessages:Record<string,string>={MODULE_NOT_ACTIVE:'ร้านยังไม่ได้ซื้อหรือเปิดใช้งานโมดูลคูปอง',MODULE_NOT_PURCHASED:'ร้านยังไม่ได้ซื้อโมดูลนี้',COUPON_UNAVAILABLE:'คูปองไม่พร้อมใช้ หมดอายุ หรือถูกใช้ครบจำนวนแล้ว',COUPON_NO_DISCOUNT:'ยอดคงเหลือไม่สามารถใช้คูปองได้',COUPON_CHANGED:'ข้อมูลคูปองเปลี่ยนแล้ว กรุณาตรวจสอบข้อมูลล่าสุด',COUPON_CODE_EXISTS:'โค้ดคูปองนี้เคยถูกใช้แล้วในร้าน',COUPON_LIMIT_BELOW_USAGE:'จำนวนคูปองต้องไม่น้อยกว่าจำนวนที่ใช้ไปแล้ว'};
export function createCouponService(url:string,key:string){
 const rpc=async(token:string,name:string,args:Record<string,unknown>)=>{const {data,error}=await createUserClient(url,key,token).rpc(name,args);if(error){const status:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};throw new ApiError(status[error.code]??503,status[error.code]?error.message:'SERVICE_UNAVAILABLE',couponMessages[error.message]??'ไม่สามารถดำเนินการกับคูปองได้');}return data;};
 return {
 async entitlements(token:string,context:UserContext){const {data,error}=await createUserClient(url,key,token).from('org_modules').select('enabled').eq('org_id',context.orgId).eq('module_code','coupons').maybeSingle();if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถโหลดสิทธิ์โมดูลได้');return {coupons:data?.enabled===true,purchased:{coupons:data!==null}};},
 async purchase(token:string,requestId:string){return entitlementsSchema.parse({...await rpc(token,'demo_purchase_coupons',{p_request:requestId}),purchased:{coupons:true}});},
 async setEnabled(token:string,moduleCode:string,enabled:boolean,requestId:string){return entitlementsSchema.parse(await rpc(token,'set_org_module_enabled',{p_module_code:moduleCode,p_enabled:enabled,p_request:requestId}));},
 async list(token:string,page:number){return couponList.parse(await rpc(token,'list_coupons',{p_page:page}));},
 async mutate(token:string,action:string,id:string|null,input:unknown,requestId:string){return couponSchema.parse(await rpc(token,'manage_coupon',{p_action:action,p_id:id,p_input:input,p_request:requestId}));},
 async report(token:string,from:string,to:string,page:number){return couponReport.parse(await rpc(token,'coupon_usage_report',{p_from:from,p_to:to,p_page:page}));}
 };
}
export type CouponService=ReturnType<typeof createCouponService>;

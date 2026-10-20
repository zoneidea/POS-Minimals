import {announceModuleChange} from '../marketplace/module-events';
import {auth,request} from '../../lib/client';
import {couponList,couponSchema,couponReport,entitlementsSchema} from './schema';
export async function couponRequest(path:string,body?:unknown,method?:'GET'|'POST'|'PATCH'|'DELETE',signal?:AbortSignal){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return request(path,data.session.access_token,body,signal,method);}
export async function getEntitlements(signal?:AbortSignal){return entitlementsSchema.parse(await couponRequest('/marketplace/entitlements',undefined,'GET',signal));}
export async function buyCouponDemo(){const value=entitlementsSchema.parse(await couponRequest('/marketplace/coupons/demo-purchase',{},'POST'));announceModuleChange();return value;}
export async function getCoupons(page:number,signal?:AbortSignal){return couponList.parse(await couponRequest(`/coupons?page=${page}`,undefined,'GET',signal));}
export async function saveCoupon(body:unknown,id?:string){return couponSchema.parse(await couponRequest(id?`/coupons/${id}`:'/coupons',body,id?'PATCH':'POST'));}
export async function deleteCoupon(id:string,version:number){return couponSchema.parse(await couponRequest(`/coupons/${id}`,{version},'DELETE'));}
export async function getCouponReport(from:string,to:string,page:number,signal?:AbortSignal){return couponReport.parse(await couponRequest(`/reports/coupons?${new URLSearchParams({from,to,page:String(page)})}`,undefined,'GET',signal));}

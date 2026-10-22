import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {createUserClient} from '../../infra/supabase/user-client.js';
import type {UserContext} from '../auth/types.js';
export function createStoreModeService(url:string,key:string){return async(token:string,context:UserContext)=>{const {data,error}=await createUserClient(url,key,token).from('store_settings').select('store_mode').eq('org_id',context.orgId).is('deleted_at',null).single();if(error||!data)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถโหลดข้อมูลโหมดร้านได้');return {storeMode:z.enum(['RETAIL','CAFE','RESTAURANT']).parse(data.store_mode??'RETAIL')};};}
export type StoreModeService=ReturnType<typeof createStoreModeService>;

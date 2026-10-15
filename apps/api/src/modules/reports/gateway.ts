import {Router} from 'express';
import {z} from 'zod';
import {gatewayReportResult} from './gateway-schema.js';
import {ApiError} from '../../infra/errors.js';
import {createUserClient} from '../../infra/supabase/user-client.js';
import {bearerToken} from '../../middleware/bearer.js';
import {snapshotCipher} from '../sales/snapshot-cipher.js';
import type {ResolveIdentity,UserContext} from '../auth/types.js';
import type {PaymentSettingsService} from '../payments/service.js';
import {dateOnly,reportRange} from './schema.js';
export const gatewayReportQuery=z.object({from:dateOnly,to:dateOnly,page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export function createGatewayReports(url:string,key:string,hex:string,settings:Pick<PaymentSettingsService,'get'>){const cipher=snapshotCipher(hex);return async(token:string,context:UserContext,query:z.infer<typeof gatewayReportQuery>)=>{
 if(context.role!=='OWNER'&&context.role!=='ACCOUNTANT')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ดูรายงาน');
 if((await settings.get(token,context)).mode!=='GATEWAY')throw new ApiError(403,'GATEWAY_DISABLED','ร้านไม่ได้เปิด Payment Gateway');
 const range=reportRange({...query,groupBy:'day'});if(!range)throw new ApiError(400,'INVALID_DATE_RANGE','ช่วงวันที่ไม่ถูกต้องหรือเกิน 366 วัน');
 const {data,error}=await createUserClient(url,key,token).rpc('gateway_sales_report',{p_from:range.from,p_to:range.to,p_page:query.page});
 if(error)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถโหลดข้อมูลได้');
 return gatewayReportResult.parse({...data,items:data.items.map((row:Record<string,unknown>)=>{const {identityCipher,...rest}=row;return {...rest,cashierName:cipher.decrypt(String(identityCipher)).cashierName};})});
 };}
export type GatewayReports=ReturnType<typeof createGatewayReports>;
export function gatewayReportRoutes(resolve:ResolveIdentity,service:GatewayReports){const router=Router();router.get('/reports/gateway',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(!['OWNER','ACCOUNTANT'].includes(context.role))throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ดูรายงาน');const query=gatewayReportQuery.safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','วันที่ไม่ถูกต้อง');res.json({success:true,data:await service(token,context,query.data)});});return router;}

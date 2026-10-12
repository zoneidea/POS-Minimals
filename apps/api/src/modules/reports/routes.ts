import { Router } from 'express';
import { ApiError } from '../../infra/errors.js';
import { bearerToken } from '../../middleware/bearer.js';
import type { ResolveIdentity } from '../auth/types.js';
import { reportType,reportQuery,reportRange } from './schema.js';
import type { ReportsService } from './service.js';
import { reportWorkbook } from './export.js';
export function reportsRoutes(resolve:ResolveIdentity,service:ReportsService){const router=Router();
 router.get('/dashboard/summary',async(req,res)=>{const token=bearerToken(req.header('Authorization')),user=await resolve(token);if(user.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');if(Object.keys(req.query).length)throw new ApiError(400,'VALIDATION_ERROR','Dashboard ใช้ช่วงวันและเดือนปัจจุบัน');res.json({success:true,data:await service.dashboard(token)});});
 router.use('/reports',async(req,res,next)=>{const user=await resolve(bearerToken(req.header('Authorization')));if(user.role!=='OWNER'&&user.role!=='ACCOUNTANT')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ดูรายงาน');next();});
 router.get('/reports/cashiers',async(req,res)=>res.json({success:true,data:await service.cashiers(bearerToken(req.header('Authorization')))}));
 router.get('/reports/:type/export.xlsx',async(req,res)=>{const type=reportType.safeParse(req.params.type),query=reportQuery.safeParse(req.query);if(!type.success||!query.success||!reportRange(query.data))throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลรายงานหรือวันที่ไม่ถูกต้อง');const report=await service.report(bearerToken(req.header('Authorization')),type.data,query.data,10000);const buffer=await reportWorkbook(report,query.data);res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').setHeader('Content-Disposition',`attachment; filename="${type.data}-report.xlsx"`);res.send(buffer);});
 router.get('/reports/:type',async(req,res)=>{const type=reportType.safeParse(req.params.type),query=reportQuery.safeParse(req.query);if(!type.success||!query.success||!reportRange(query.data))throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลรายงานหรือวันที่ไม่ถูกต้อง');res.json({success:true,data:await service.report(bearerToken(req.header('Authorization')),type.data,query.data)});});return router;
}

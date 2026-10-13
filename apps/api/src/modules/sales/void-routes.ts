import { Router } from 'express';
import { z } from 'zod';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import { voidInput,type SaleManagementService } from './void-schema.js';
export function saleManagementRoutes(resolve:ResolveIdentity,service:SaleManagementService){const router=Router();
 router.use(async(req,_res,next)=>{const context=await resolve(bearerToken(req.header('Authorization')));if(!['OWNER','EMPLOYEE'].includes(context.role))throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');_res.locals.saleContext=context;next();});
 router.get('/',async(req,res)=>{const query=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลแบ่งหน้าไม่ถูกต้อง');res.json({success:true,data:await service.list(bearerToken(req.header('Authorization')),res.locals.saleContext,query.data.page)});});
 router.post('/:id/void',async(req,res)=>{if(res.locals.saleContext.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');const id=z.uuid().safeParse(req.params.id),input=voidInput.safeParse(req.body);if(!id.success||!input.success)throw new ApiError(400,'VALIDATION_ERROR','กรุณาระบุบิลและเหตุผลไม่เกิน 500 ตัวอักษร');res.json({success:true,data:await service.void(bearerToken(req.header('Authorization')),id.data,input.data.reason,res.locals.requestId)});});return router;}

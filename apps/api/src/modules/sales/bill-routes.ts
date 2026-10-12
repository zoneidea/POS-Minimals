import { Router } from 'express';
import { z } from 'zod';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import { dateOnly,reportQuery } from '../reports/schema.js';
import type { BillService } from './bill-service.js';
export function billRoutes(resolve:ResolveIdentity,service:BillService){const router=Router();
 async function authorize(token:string){const context=await resolve(token);if(!['OWNER','ACCOUNTANT'].includes(context.role))throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ดูบิล');}
 router.get('/bills',async(req,res)=>{const token=bearerToken(req.header('Authorization'));await authorize(token);const query=reportQuery.extend({period:dateOnly.optional()}).safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ตัวกรองบิลไม่ถูกต้อง');res.json({success:true,data:await service.list(token,query.data.page,query.data)});});
 router.get('/:id/receipt',async(req,res)=>{const token=bearerToken(req.header('Authorization'));await authorize(token);const id=z.uuid().safeParse(req.params.id);if(!id.success||Object.keys(req.query).length)throw new ApiError(400,'VALIDATION_ERROR','เลขที่บิลไม่ถูกต้อง');res.json({success:true,data:await service.receipt(token,id.data)});});return router;
}

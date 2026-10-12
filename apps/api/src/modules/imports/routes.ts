import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import type { ImportService } from './service.js';
import { parseWorkbook,templateWorkbook } from './workbook.js';
export function importRoutes(resolve:ResolveIdentity,service:ImportService){const router=Router();router.use(async(req,res,next)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');res.locals.importToken=token;next();});
 router.get('/template',async(_req,res)=>{res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment('product-import-template.xlsx').send(await templateWorkbook());});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1}}).single('file');
 router.post('/preview',(req,res,next)=>upload(req,res,error=>error?next(new ApiError(422,'INVALID_UPLOAD','เลือกไฟล์ XLSX หนึ่งไฟล์ ไม่เกิน 5 MB')):next()),async(req,res)=>{if(!req.file||!req.file.originalname.toLowerCase().endsWith('.xlsx'))throw new ApiError(422,'INVALID_UPLOAD','เลือกไฟล์ .xlsx');const {rows,errors}=await parseWorkbook(req.file.buffer);res.json({success:true,data:await service.preview(res.locals.importToken,rows,errors,res.locals.requestId)});});
 router.get('/:batchId',async(req,res)=>{const id=z.uuid().safeParse(req.params.batchId);if(!id.success)throw new ApiError(400,'VALIDATION_ERROR','batch ไม่ถูกต้อง');res.json({success:true,data:await service.get(res.locals.importToken,id.data)});});
 router.post('/:batchId/commit',async(req,res)=>{const id=z.uuid().safeParse(req.params.batchId);if(!id.success||!z.object({}).strict().safeParse(req.body).success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลยืนยันไม่ถูกต้อง');res.json({success:true,data:await service.commit(res.locals.importToken,id.data,res.locals.requestId)});});return router;
}

import express,{ Router } from 'express';
import { z } from 'zod';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import type { UploadProductImage } from './image-service.js';
export function productImageRoutes(resolve:ResolveIdentity,upload:UploadProductImage){const router=Router();
 router.post('/:id/image',async(req,res,next)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');res.locals.imageToken=token;res.locals.imageContext=context;next();},express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),async(req,res)=>{
 const id=z.uuid().safeParse(req.params.id),version=z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).safeParse(req.query.expectedVersion);
 if(!id.success||!version.success||!Buffer.isBuffer(req.body)||Object.keys(req.query).some(key=>key!=='expectedVersion'))throw new ApiError(400,'VALIDATION_ERROR','รหัสสินค้า เวอร์ชัน หรือไฟล์รูปไม่ถูกต้อง');
 res.json({success:true,data:await upload(res.locals.imageToken,res.locals.imageContext,id.data,version.data,req.body,req.header('Content-Type')?.split(';')[0]??'',res.locals.requestId)});
 });return router;
}

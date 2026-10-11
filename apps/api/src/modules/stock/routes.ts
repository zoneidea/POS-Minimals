import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../infra/errors.js';
import { bearerToken } from '../../middleware/bearer.js';
import type { ResolveIdentity } from '../auth/types.js';
import { stockInput,historyQuery,type StockService } from './schema.js';
export function stockRoutes(resolve:ResolveIdentity,service:StockService){
 const router=Router();
 router.get('/stock-movements',async(req,res)=>{
  const token=bearerToken(req.header('Authorization')),context=await resolve(token);
  if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');
  const query=historyQuery.safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ตัวเลือกประวัติไม่ถูกต้อง');
  res.json({success:true,data:await service.history(token,context,query.data)});
 });
 router.post('/products/:id/adjust-stock',async(req,res)=>{
  const token=bearerToken(req.header('Authorization')),context=await resolve(token);
  if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');
  const id=z.uuid().safeParse(req.params.id),key=z.uuid().safeParse(req.header('Idempotency-Key')),input=stockInput.safeParse(req.body);
  if(!id.success||!key.success||!input.success)throw new ApiError(400,'VALIDATION_ERROR','จำนวน เหตุผล หรือรหัสคำขอไม่ถูกต้อง');
  res.json({success:true,data:await service.adjust(token,id.data,input.data,key.data,res.locals.requestId)});
 });
 return router;
}

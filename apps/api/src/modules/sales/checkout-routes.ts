import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../infra/errors.js';
import { bearerToken } from '../../middleware/bearer.js';
import type { ResolveIdentity } from '../auth/types.js';
import { checkoutInput,type CheckoutService } from './checkout-schema.js';
export function checkoutRoutes(resolve:ResolveIdentity,service:CheckoutService){const router=Router();
 router.post('/',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(context.role!=='OWNER'&&context.role!=='EMPLOYEE')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ขาย');const input=checkoutInput.safeParse(req.body),key=z.uuid().safeParse(req.header('Idempotency-Key'));if(!input.success||!key.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลบิลหรือรหัสคำขอไม่ถูกต้อง');const sale=await service.commit(token,context,input.data,key.data,res.locals.requestId);res.status(sale.replayed?200:201).json({success:true,data:sale});});
 router.get('/by-idempotency-key/:key',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(context.role!=='OWNER'&&context.role!=='EMPLOYEE')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ขาย');const key=z.uuid().safeParse(req.params.key);if(!key.success)throw new ApiError(400,'VALIDATION_ERROR','รหัสคำขอไม่ถูกต้อง');res.json({success:true,data:await service.recover(token,context,key.data)});});return router;
}

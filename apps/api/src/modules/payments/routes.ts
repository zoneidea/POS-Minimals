import { Router } from 'express';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import type { PaymentSettingsService } from './service.js';
import { paymentSettingsInput } from './schema.js';
export function paymentSettingsRoutes(resolve:ResolveIdentity,service:PaymentSettingsService){const router=Router();
 router.get('/payments/config',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);res.json({success:true,data:await service.get(token,context)});});
 router.patch('/settings/payments',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านแก้ไขได้');const input=paymentSettingsInput.safeParse(req.body);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลการชำระเงินไม่ถูกต้อง');res.json({success:true,data:await service.save(token,input.data,res.locals.requestId)});});return router;
}

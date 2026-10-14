import { Router } from 'express';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import {activityQuery,type ActivityService} from './service.js';
export function activityRoutes(resolve:ResolveIdentity,service:ActivityService){const router=Router();router.get('/activity-logs',async(req,res)=>{
 const token=bearerToken(req.header('Authorization')),context=await resolve(token);
 if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');
 const query=activityQuery.safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ตัวเลือกประวัติไม่ถูกต้อง');
 res.json({success:true,data:await service.list(token,context,query.data)});
});return router;}

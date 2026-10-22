import {Router} from 'express';import {cafeStarterAction} from '@pos/contracts/cafe-options';
import {bearerToken} from '../../middleware/bearer.js';import {ApiError} from '../../infra/errors.js';
import type {ResolveIdentity} from '../auth/types.js';import type {CafeStarterService} from './service.js';
export function cafeStarterRoutes(resolve:ResolveIdentity,service:CafeStarterService){
 const router=Router();
 const owner=async(header:string|undefined)=>{const token=bearerToken(header),user=await resolve(token);if(user.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');return token;};
 router.get('/management/cafe/starter',async(req,res)=>res.json({success:true,data:await service.read(await owner(req.header('Authorization')))}));
 router.post('/management/cafe/starter',async(req,res)=>{const token=await owner(req.header('Authorization')),body=cafeStarterAction.safeParse(req.body);if(!body.success)throw new ApiError(400,'VALIDATION_ERROR','คำสั่งหรือเวอร์ชันชุดข้อมูลไม่ถูกต้อง');res.json({success:true,data:await service.mutate(token,body.data.action,res.locals.requestId)});});
 return router;
}

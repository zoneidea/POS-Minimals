import { Router } from 'express';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import { catalogQuery,type CatalogService } from './schema.js';
export function catalogRoutes(resolve:ResolveIdentity,service:CatalogService){
 const router=Router();
 router.get('/',async(req,res)=>{
  const token=bearerToken(req.header('Authorization')),context=await resolve(token);
  if(context.role!=='OWNER'&&context.role!=='EMPLOYEE')throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์เข้าหน้าขาย');
  const query=catalogQuery.safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ตัวเลือกค้นหาไม่ถูกต้อง');
  res.json({success:true,data:await service.list(token,query.data)});
 });
 return router;
}

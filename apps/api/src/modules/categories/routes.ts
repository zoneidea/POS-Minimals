import { Router } from 'express';
import { z } from 'zod';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import {categoryInput,type CategoryService,type CategoryOperation} from './schema.js';
export function categoryRoutes(resolve:ResolveIdentity,service:CategoryService){const router=Router();
 router.get('/',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(!['OWNER','EMPLOYEE'].includes(context.role))throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ดูหมวดหมู่');const query=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(30)}).strict().safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ตัวเลือกหน้าไม่ถูกต้อง');res.json({success:true,data:await service.list(token,context,query.data.page,query.data.limit)});});
 for(const [method,path,operation] of [['post','/','create'],['patch','/:id','update'],['delete','/:id','delete']] as const){router[method](path,async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');const id=operation==='create'?null:z.uuid().safeParse('id' in req.params ? req.params.id : undefined);if(id!==null&&!id.success)throw new ApiError(400,'VALIDATION_ERROR','รหัสหมวดหมู่ไม่ถูกต้อง');const input=operation==='delete'?null:categoryInput.safeParse(req.body);if(input!==null&&!input.success)throw new ApiError(400,'VALIDATION_ERROR','ชื่อหมวดหมู่ไม่ถูกต้อง');res.json({success:true,data:await service.mutate(token,context,operation as CategoryOperation,id?.success?id.data:null,input?.success?input.data.name:null,res.locals.requestId)});});}
 return router;
}

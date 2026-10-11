import { Router } from 'express';
import { z } from 'zod';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import type { ResolveIdentity } from '../auth/types.js';
import { productInput,productUpdate,productDelete,productQuery,type ProductService } from './schema.js';
export function productRoutes(resolve:ResolveIdentity,service:ProductService){
 const router=Router();
 router.get('/',async(req,res)=>{
  const token=bearerToken(req.header('Authorization')),context=await resolve(token);
  if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');
  const query=productQuery.safeParse(req.query);if(!query.success)throw new ApiError(400,'VALIDATION_ERROR','ตัวเลือกหน้าไม่ถูกต้อง');
  res.json({success:true,data:await service.list(token,context,query.data.page,query.data.limit)});
 });
 for(const [method,path,operation] of [['post','/','create'],['patch','/:id','update'],['delete','/:id','delete']] as const){
  router[method](path,async(req,res)=>{
   const token=bearerToken(req.header('Authorization')),context=await resolve(token);
   if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');
   const id=operation==='create'?null:z.uuid().safeParse('id' in req.params?req.params.id:undefined);
   if(id&&!id.success)throw new ApiError(400,'VALIDATION_ERROR','รหัสสินค้าไม่ถูกต้อง');
   const schema=operation==='create'?productInput:operation==='update'?productUpdate:productDelete;
   const parsed=schema.safeParse(req.body);if(!parsed.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลสินค้าไม่ถูกต้อง');
   const body=parsed.data;
   const input='barcode' in body?{barcode:body.barcode,name:body.name,categoryId:body.categoryId,salePrice:body.salePrice,unitCost:body.unitCost}:null;
   res.json({success:true,data:await service.mutate(token,operation,id?.success?id.data:null,input,'expectedVersion' in body?body.expectedVersion:null,res.locals.requestId)});
  });
 }
 return router;
}

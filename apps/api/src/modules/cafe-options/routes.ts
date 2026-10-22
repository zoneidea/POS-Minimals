import {Router} from 'express';import {z} from 'zod';
import {cafeGroupInput,validCafeGroup} from '@pos/contracts/cafe-options';
import {bearerToken} from '../../middleware/bearer.js';import {ApiError} from '../../infra/errors.js';
import type {ResolveIdentity} from '../auth/types.js';import type {CafeOptionsService} from './service.js';
export function cafeOptionsRoutes(resolve:ResolveIdentity,service:CafeOptionsService){const router=Router();
 const identity=async(req:{header:(name:string)=>string|undefined},owner=false)=>{const token=bearerToken(req.header('Authorization')),user=await resolve(token);if(owner&&user.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');return token;};
 router.get('/cafe/options',async(req,res)=>res.json({success:true,data:await service.read(await identity(req))}));
 router.get('/management/cafe/options',async(req,res)=>res.json({success:true,data:await service.read(await identity(req,true),true)}));
 router.post('/management/cafe/option-groups',async(req,res)=>{const token=await identity(req,true),input=cafeGroupInput.refine(validCafeGroup).safeParse(req.body);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','กรุณาตรวจสอบกลุ่มตัวเลือก ราคา และจำนวนที่เลือกได้');res.json({success:true,data:await service.save(token,null,input.data,null,res.locals.requestId)});});
 router.patch('/management/cafe/option-groups/:id',async(req,res)=>{const token=await identity(req,true),input=cafeGroupInput.extend({version:z.number().int().positive()}).refine(validCafeGroup).safeParse(req.body),id=z.uuid().safeParse(req.params.id);if(!input.success||!id.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลตัวเลือกไม่ถูกต้อง');const {version,...data}=input.data;res.json({success:true,data:await service.save(token,id.data,data,version,res.locals.requestId)});});return router;
}

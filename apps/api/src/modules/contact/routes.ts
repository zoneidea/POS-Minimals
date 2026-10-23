import {Router} from 'express';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {contactInput,type ContactService} from './service.js';
export function contactRoutes(service:ContactService,origins:string[]){
 const router=Router();
 router.get('/config',(_req,res)=>res.json({success:true,data:{enabled:service.enabled}}));
 router.post('/',async(req,res)=>{
  if(!origins.includes(req.header('Origin')??''))throw new ApiError(403,'FORBIDDEN','กรุณาส่งข้อความผ่านเว็บไซต์ POSJung');
  const body=contactInput.safeParse(req.body),key=z.uuid().safeParse(req.header('Idempotency-Key'));
  if(!body.success||!key.success)throw new ApiError(400,'VALIDATION_ERROR','กรุณาตรวจสอบชื่อ อีเมล หัวข้อ และข้อความ');
  const address=(process.env.VERCEL?req.header('x-vercel-forwarded-for')?.split(',')[0]?.trim():undefined)??req.ip??'unknown';
  await service.send(body.data,key.data,address);
  res.status(202).json({success:true,data:{accepted:true}});
 });
 return router;
}

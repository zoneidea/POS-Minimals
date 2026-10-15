import {cachedRead,type NodeReadCache} from '../../infra/node-read-cache.js';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../infra/errors.js';
import { bearerToken } from '../../middleware/bearer.js';
import type { ResolveIdentity } from '../auth/types.js';
import type { ManagementService } from './service.js';
import { settingsInput,staffInput,inviteInput } from './schema.js';
export function managementRoutes(resolve:ResolveIdentity,service:ManagementService,cache?:NodeReadCache){const router=Router();
 router.get('/users/invitation',async(req,res)=>res.json({success:true,data:await service.invitationContext(bearerToken(req.header('Authorization')))}));
 router.post('/users/accept-invitation',async(req,res)=>{const input=z.object({alias:z.string().trim().min(1).max(80)}).strict().safeParse(req.body);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','กรุณาระบุชื่อที่ใช้แสดง');res.json({success:true,data:await service.accept(bearerToken(req.header('Authorization')),input.data.alias,res.locals.requestId)});});
 router.use(async(req,res,next)=>{const context=await resolve(bearerToken(req.header('Authorization')));if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านเท่านั้น');res.locals.managementContext=context;next();});
 router.get('/settings/store',async(req,res)=>res.json({success:true,data:await cachedRead(cache,bearerToken(req.header('Authorization')),res.locals.managementContext,'store',null,30000,()=>service.settings(bearerToken(req.header('Authorization')),res.locals.managementContext))}));
 router.patch('/settings/store',async(req,res)=>{const input=settingsInput.safeParse(req.body);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลร้านไม่ถูกต้อง');res.json({success:true,data:await service.saveSettings(bearerToken(req.header('Authorization')),input.data,res.locals.requestId)});});
 router.get('/users',async(req,res)=>{const input=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().safeParse(req.query);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลแบ่งหน้าไม่ถูกต้อง');res.json({success:true,data:await cachedRead(cache,bearerToken(req.header('Authorization')),res.locals.managementContext,'members',input.data,5000,()=>service.members(bearerToken(req.header('Authorization')),res.locals.managementContext,input.data.page))});});
 router.patch('/users/:id',async(req,res)=>{const input=staffInput.safeParse(req.body),id=z.uuid().safeParse(req.params.id);if(!input.success||!id.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลสมาชิกไม่ถูกต้อง');res.json({success:true,data:await service.updateMember(bearerToken(req.header('Authorization')),id.data,input.data,res.locals.requestId)});});
 router.post('/users/invitations',async(req,res)=>{const input=inviteInput.safeParse(req.body);if(!input.success)throw new ApiError(400,'VALIDATION_ERROR','อีเมลหรือสิทธิ์ไม่ถูกต้อง');res.json({success:true,data:await service.invite(bearerToken(req.header('Authorization')),input.data,res.locals.requestId)});});return router;}

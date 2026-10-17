import {Router} from 'express';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {bearerToken} from '../../middleware/bearer.js';
import type {ResolveIdentity} from '../auth/types.js';
import {reportRange} from '../reports/schema.js';
import {couponInput,couponUpdate} from './schema.js';
import type {CouponService} from './service.js';
export function couponRoutes(resolve:ResolveIdentity,service:CouponService){
 const r=Router(),pageSchema=z.coerce.number().int().min(1).max(100000).default(1);
 const parse=<T>(schema:z.ZodType<T>,value:unknown)=>{const p=schema.safeParse(value);if(!p.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลคูปองหรือช่วงวันที่ไม่ถูกต้อง');return p.data;};
 const identity=async(req:{header:(name:string)=>string|undefined},roles:string[])=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);if(!roles.includes(context.role))throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ใช้งานส่วนนี้');return {token,context};};
 r.get('/marketplace/entitlements',async(req,res)=>{const {token,context}=await identity(req,['OWNER','EMPLOYEE','ACCOUNTANT']);res.json({success:true,data:await service.entitlements(token,context)});});
 r.post('/marketplace/coupons/demo-purchase',async(req,res)=>{const {token}=await identity(req,['OWNER']);parse(z.object({}).strict(),req.body);res.json({success:true,data:await service.purchase(token,res.locals.requestId)});});
 r.get('/coupons',async(req,res)=>{const {token}=await identity(req,['OWNER']);res.json({success:true,data:await service.list(token,parse(pageSchema,req.query.page))});});
 r.post('/coupons',async(req,res)=>{const {token}=await identity(req,['OWNER']);res.status(201).json({success:true,data:await service.mutate(token,'CREATE',null,parse(couponInput,req.body),res.locals.requestId)});});
 r.patch('/coupons/:id',async(req,res)=>{const {token}=await identity(req,['OWNER']);res.json({success:true,data:await service.mutate(token,'UPDATE',parse(z.uuid(),req.params.id),parse(couponUpdate,req.body),res.locals.requestId)});});
 r.delete('/coupons/:id',async(req,res)=>{const {token}=await identity(req,['OWNER']);res.json({success:true,data:await service.mutate(token,'DELETE',parse(z.uuid(),req.params.id),parse(z.object({version:z.number().int().positive().safe()}).strict(),req.body),res.locals.requestId)});});
 r.get('/reports/coupons',async(req,res)=>{const {token}=await identity(req,['OWNER','ACCOUNTANT']);const q=parse(z.object({from:z.iso.date(),to:z.iso.date(),page:pageSchema}).strict(),req.query),range=reportRange({...q,groupBy:'day'});if(!range)throw new ApiError(400,'INVALID_RANGE','ช่วงวันที่ไม่ถูกต้องหรือเกิน 366 วัน');res.json({success:true,data:await service.report(token,range.from,range.to,q.page)});});
 return r;
}

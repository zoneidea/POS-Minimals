import {Router} from 'express';
import {z} from 'zod';
import {guestOrderInput} from '@pos/contracts/restaurant';
import {bearerToken} from '../../middleware/bearer.js';
import {ApiError} from '../../infra/errors.js';
import type {ResolveIdentity} from '../auth/types.js';
import type {GuestOrdersService} from './service.js';
function parse<T>(schema:z.ZodType<T>,input:unknown){const v=schema.safeParse(input);if(!v.success)throw new ApiError(400,'VALIDATION_ERROR','ข้อมูลคำขอไม่ถูกต้อง');return v.data;}
export function guestOrderRoutes(service:GuestOrdersService){const r=Router();r.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');next();});
 const handle=(operation:'menu'|'order'|'send')=>async(req:import('express').Request,res:import('express').Response)=>{const token=bearerToken(req.header('Authorization'));if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ApiError(401,'UNAUTHENTICATED','กรุณาสแกน QR ของโต๊ะอีกครั้ง');if(Object.keys(req.query).length)throw new ApiError(400,'VALIDATION_ERROR','ไม่รองรับพารามิเตอร์นี้');const body=operation==='send'?parse(guestOrderInput,req.body):undefined;try{res.json({success:true,data:await service.guest(token,req.ip??req.socket.remoteAddress??'unknown',operation,body,res.locals.requestId)});}catch(e){if(e instanceof ApiError&&e.status===429)res.set('Retry-After','60');throw e;}};
 r.get('/menu',handle('menu'));r.get('/order',handle('order'));r.post('/orders',handle('send'));return r;}
export function staffGuestAccessRoutes(resolve:ResolveIdentity,service:GuestOrdersService){const r=Router();for(const revoke of [false,true])r.post(`/restaurant/bills/:id/guest-access${revoke?'/revoke':''}`,async(req,res)=>{const token=bearerToken(req.header('Authorization')),user=await resolve(token);if(!['OWNER','EMPLOYEE'].includes(user.role))throw new ApiError(403,'FORBIDDEN','ไม่มีสิทธิ์ออก QR โต๊ะ');const id=parse(z.uuid(),req.params.id),input=parse(z.object({version:z.number().int().positive()}).strict(),req.body);res.set('Cache-Control','no-store').json({success:true,data:await service.issue(token,id,input.version,revoke,res.locals.requestId)});});return r;}

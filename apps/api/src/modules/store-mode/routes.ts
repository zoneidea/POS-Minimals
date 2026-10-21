import {Router} from 'express';
import {bearerToken} from '../../middleware/bearer.js';
import type {ResolveIdentity} from '../auth/types.js';
import type {StoreModeService} from './service.js';
export function storeModeRoutes(resolve:ResolveIdentity,read:StoreModeService){const router=Router();router.get('/settings/store-mode',async(req,res)=>{const token=bearerToken(req.header('Authorization')),context=await resolve(token);res.json({success:true,data:await read(token,context)});});return router;}

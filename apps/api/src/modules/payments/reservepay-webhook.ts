import {createHmac,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {Router,raw} from 'express';
import {z} from 'zod';
import {ApiError} from '../../infra/errors.js';
import {verifiedAmounts} from './gateway-confirm.js';

const eventSchema=z.object({event_id:z.string().min(1).max(160),event:z.enum(['payment_expired','payment_completed']),payment_id:z.string().regex(/^pay_[\w-]+$/),external_id:z.string().optional().nullable(),status:z.string().min(1),delivered_at:z.number().int().positive()});
type WebhookEvent=z.infer<typeof eventSchema>;
type Session={session_hash:string;org_id:string;amount_minor:string;sale_id:string|null};
export interface WebhookLedger {
 find(paymentId:string,hash?:string):Promise<Session|null>;
 record(event:WebhookEvent,session:Session):Promise<void>;
 finish(eventId:string,status:string):Promise<void>;
 verify(session:Session,fee:string,paidAt:string):Promise<void>;
 complete(hash:string,requestId:string):Promise<void>;
}
export function reservepayWebhookLedger(url:string,secret:string):WebhookLedger{
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 return {
  async find(paymentId,hash){let query=db.from('reservepay_payment_sessions').select('session_hash,org_id,amount_minor,sale_id').eq('payment_id',paymentId);if(hash)query=query.eq('session_hash',hash);const {data,error}=await query.maybeSingle();if(error)throw new ApiError(503,'WEBHOOK_STORAGE_UNAVAILABLE','Webhook storage unavailable');return data as Session|null;},
  async record(event,session){const {error}=await db.from('reservepay_webhook_events').upsert({event_id:event.event_id,org_id:session.org_id,session_hash:session.session_hash,payment_id:event.payment_id,event:event.event,reported_status:event.status,delivered_at:new Date(event.delivered_at*1000).toISOString()},{onConflict:'event_id',ignoreDuplicates:true});if(error)throw new ApiError(503,'WEBHOOK_STORAGE_UNAVAILABLE','Webhook storage unavailable');},
  async finish(eventId,status){const {error}=await db.from('reservepay_webhook_events').update({provider_status:status,processed_at:new Date().toISOString()}).eq('event_id',eventId);if(error)throw new ApiError(503,'WEBHOOK_STORAGE_UNAVAILABLE','Webhook storage unavailable');},
  async verify(session,fee,paidAt){const {error}=await db.from('reservepay_payment_sessions').update({verified_fee:fee,paid_at:paidAt,verified_at:new Date().toISOString()}).eq('session_hash',session.session_hash).eq('org_id',session.org_id).is('sale_id',null);if(error)throw new ApiError(503,'PAID_NOT_POSTED','Paid payment could not be verified locally');},
  async complete(hash,requestId){const {error}=await db.rpc('complete_gateway_sale_webhook',{p_hash:hash,p_request:requestId});if(error)throw new ApiError(503,'PAID_NOT_POSTED','Paid payment could not be posted');}
 };
}
export function verifyReservepaySignature(body:Buffer,header:string|undefined,key:string|undefined){
 if(!key||!header?.startsWith('hmac_sha256='))return false;
 const hex=header.slice('hmac_sha256='.length);
 if(!/^[a-f\d]{64}$/i.test(hex))return false;
 const signingKey=Buffer.from(key,'base64');if(!signingKey.length)return false;
 const expected=createHmac('sha256',signingKey).update(body).digest();
 return timingSafeEqual(expected,Buffer.from(hex,'hex'));
}
export function createReservepayWebhook(options:{verificationKey?:string;apiKey?:string;ledger?:WebhookLedger;send?:typeof fetch}){
 return async(body:Buffer,signature:string|undefined,requestId:string)=>{
  if(!options.verificationKey||!options.apiKey||!options.ledger)throw new ApiError(503,'WEBHOOK_UNAVAILABLE','Webhook is not configured');
  if(!verifyReservepaySignature(body,signature,options.verificationKey))throw new ApiError(401,'INVALID_SIGNATURE','Invalid webhook signature');
  let value:unknown;try{value=JSON.parse(body.toString('utf8'));}catch{throw new ApiError(400,'VALIDATION_ERROR','Invalid webhook payload');}
  const parsed=eventSchema.safeParse(value);if(!parsed.success)throw new ApiError(400,'VALIDATION_ERROR','Invalid webhook payload');
  const event=parsed.data;
  // Ignore other merchant payments if the ReservePay account serves more than one application.
  if(event.external_id&&!event.external_id.startsWith('pos_'))return {received:true};
  const hash=event.external_id?.slice(4);
  if(hash&&!/^[a-f\d]{64}$/.test(hash))throw new ApiError(400,'VALIDATION_ERROR','Invalid payment reference');
  const session=await options.ledger.find(event.payment_id,hash);
  // A notification can race the initiate-payment response that saves payment_id. Retry it.
  if(!session){if(!hash)return {received:true};throw new ApiError(503,'PAYMENT_REFERENCE_UNAVAILABLE','Payment reference is not ready');}
  let response:Response;
  try{response=await (options.send??fetch)('https://api.reservepay.com/merchants/find-payment',{method:'POST',headers:{Authorization:`Bearer ${options.apiKey}`,'Api-Version':'2025-04-01','Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({payment_id:event.payment_id}),signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw new ApiError(503,'PAYMENT_UNKNOWN','Provider verification unavailable');}
  if(!response.ok){await response.body?.cancel();throw new ApiError(503,'PAYMENT_UNKNOWN','Provider verification unavailable');}
  let provider:unknown;try{provider=await response.json();}catch{throw new ApiError(503,'PAYMENT_UNKNOWN','Provider verification unavailable');}
  const {payment,fee}=verifiedAmounts(provider,event.payment_id,session.session_hash,session.amount_minor);
  await options.ledger.record(event,session);
  if(payment.status==='SUCCESSFUL'){
   if(!payment.captured_at)throw new ApiError(503,'PAID_NOT_POSTED','Captured timestamp missing');
   if(!session.sale_id)await options.ledger.verify(session,fee,new Date(payment.captured_at*1000).toISOString());
   await options.ledger.complete(session.session_hash,requestId);
  }
  await options.ledger.finish(event.event_id,payment.status);
  return {received:true};
 };
}
export type ReservepayWebhook=ReturnType<typeof createReservepayWebhook>;
export function reservepayWebhookRoutes(service:ReservepayWebhook){const router=Router();router.post('/reservepay',raw({type:'application/json',limit:'16kb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body))throw new ApiError(415,'VALIDATION_ERROR','JSON body required');await service(req.body,req.header('Reservepay-Signature'),res.locals.requestId);res.status(200).json({received:true});});return router;}

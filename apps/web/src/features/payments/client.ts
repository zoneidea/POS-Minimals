import { z } from 'zod';
import { call } from '../management/client';
export const paymentConfig=z.object({mode:z.enum(['DISABLED','UPLOAD','GATEWAY']),qrImage:z.string(),gatewayReady:z.boolean(),version:z.number().int().positive(),bankCode:z.string().optional(),maskedAccountNumber:z.string().optional()});
export type PaymentConfig=z.infer<typeof paymentConfig>;
export async function getPaymentConfig(signal?:AbortSignal){return paymentConfig.parse(await call('/payments/config',undefined,undefined,signal));}
export function savePaymentConfig(value:{mode:PaymentConfig['mode'];qrImage:string;bankCode:string;accountNumber:string;version:number}){return call('/settings/payments',value,'PATCH') as Promise<{version:number;bankLinkStatus?:string}>;}
export async function qrFile(file:File):Promise<string>{
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw new Error('เลือกรูป PNG หรือ JPEG ขนาดไม่เกิน 5 MB');
 const bitmap=await createImageBitmap(file);
 try{const canvas=document.createElement('canvas'),scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext('2d');if(!context)throw new Error('ไม่สามารถอ่านรูปได้');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);let value=canvas.toDataURL('image/png');if(value.length>50000)value=canvas.toDataURL('image/jpeg',0.85);if(value.length>50000)throw new Error('รูปมีรายละเอียดมากเกินไป กรุณาครอปเฉพาะ QRCode');return value;}finally{bitmap.close();}
}

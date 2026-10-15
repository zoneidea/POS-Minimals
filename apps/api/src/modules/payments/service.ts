import type {BankUnlink} from './reservepay-unlink.js';
import type {BankSync} from './reservepay-bank.js';
import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import type { UserContext } from '../auth/types.js';
import { paymentSettingsInput,maskAccount } from './schema.js';
const stored=paymentSettingsInput.omit({version:true}).extend({bankDeleted:z.boolean().default(false),bankDeletedAt:z.string().optional()});
export function createPaymentSettingsService(url:string,publishable:string,hex:string,syncBank?:BankSync,unlinkBank?:BankUnlink){
 const key=Buffer.from(hex,'hex');
 const encrypt=(input:unknown)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('pos:payment-settings:v1'));const data=Buffer.concat([cipher.update(JSON.stringify(input),'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');};
 const decrypt=(value:string)=>{const [,iv,tag,data]=value.split('.');const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv!,'base64'));cipher.setAAD(Buffer.from('pos:payment-settings:v1'));cipher.setAuthTag(Buffer.from(tag!,'base64'));return stored.parse(JSON.parse(Buffer.concat([cipher.update(Buffer.from(data!,'base64')),cipher.final()]).toString('utf8')));};
 const check=(error:{code?:string}|null)=>{if(error)throw new ApiError(error.code==='PT409'?409:error.code==='PT403'?403:503,error.code==='PT409'?'VERSION_CONFLICT':'SERVICE_UNAVAILABLE','ไม่สามารถบันทึกหรือโหลดการตั้งค่าชำระเงินได้');};
 const read=async(token:string)=>{const {data,error}=await createUserClient(url,publishable,token).rpc('read_payment_settings');check(error);return {value:data.cipher?decrypt(data.cipher):{mode:'DISABLED' as const,qrImage:'',bankCode:'',accountName:'',accountNumber:'',bankDeleted:false},version:Number(data.version)};};
 return {
 async unlink(token:string,version:number,requestId:string,context:UserContext){
  if(context.role!=='OWNER')throw new ApiError(403,'FORBIDDEN','เฉพาะเจ้าของร้านลบบัญชีได้');
  const current=await read(token);
  if(current.version!==version)throw new ApiError(409,'VERSION_CONFLICT','ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเปิดหน้าใหม่');
  if(current.value.bankDeleted||!current.value.accountNumber)throw new ApiError(404,'NOT_FOUND','ไม่มีข้อมูลบัญชี');
  const status=unlinkBank?await unlinkBank(context.orgId,version,requestId):'NOT_CONFIGURED';
  if(status!=='SENT')throw new ApiError(503,'SERVICE_UNAVAILABLE','ยังยืนยันการลบบัญชีกับ ReservePay ไม่สำเร็จ ข้อมูลบัญชียังคงอยู่ กรุณาตรวจสอบผลก่อนทำรายการซ้ำ');
  const next={...current.value,bankDeleted:true,bankDeletedAt:new Date().toISOString(),mode:current.value.mode==='GATEWAY'?'DISABLED':current.value.mode};
  const {data,error}=await createUserClient(url,publishable,token).rpc('save_payment_settings',{p_cipher:encrypt(next),p_version:version,p_request:requestId});
  if(error)throw new ApiError(409,'VERSION_CONFLICT','ReservePay ยืนยันการลบแล้ว แต่ข้อมูลในระบบเปลี่ยนระหว่างทำรายการ กรุณาตรวจสอบสถานะบัญชีก่อนทำรายการต่อ');
  return data;
 },
 async get(token:string,context:UserContext){const {value,version}=await read(token);const canView=context.role==='OWNER'||context.role==='ACCOUNTANT';return {mode:value.mode,qrImage:value.mode==='UPLOAD'?value.qrImage:'',gatewayReady:false,version,...(canView?{bankCode:value.bankDeleted?'':value.bankCode,accountName:value.bankDeleted?'':value.accountName,maskedAccountNumber:value.bankDeleted?'':maskAccount(value.accountNumber)}:{})};},
 async save(token:string,input:z.infer<typeof paymentSettingsInput>,requestId:string,context?:UserContext){const {value}=await read(token);const {version,...next}=input;if(next.mode==='GATEWAY'&&next.bankCode!==value.bankCode&&!next.accountNumber)throw new ApiError(400,'VALIDATION_ERROR','กรุณากรอกเลขบัญชีใหม่เมื่อเปลี่ยนธนาคาร');next.accountNumber=next.accountNumber||(value.bankDeleted?'':value.accountNumber);
  if(next.mode==='UPLOAD'&&!next.qrImage)throw new ApiError(400,'VALIDATION_ERROR','กรุณาอัปโหลดรูป QRCode');
  if(next.mode==='GATEWAY'&&!next.accountName)throw new ApiError(400,'VALIDATION_ERROR','กรุณากรอกชื่อบัญชี');
  if(next.mode==='GATEWAY'&&(!next.bankCode||!next.accountNumber))throw new ApiError(400,'VALIDATION_ERROR','กรุณาเลือกธนาคารและกรอกเลขบัญชี');
  if(next.qrImage){try{const image=Buffer.from(next.qrImage.split(',')[1]!,'base64');const meta=await sharp(image,{limitInputPixels:16000000}).metadata();if(!['png','jpeg'].includes(meta.format??'')||(meta.pages??1)>1)throw new Error();await sharp(image).png().toBuffer();}catch{throw new ApiError(400,'VALIDATION_ERROR','รูป QRCode ต้องเป็น PNG หรือ JPEG ที่ถูกต้อง');}}
  const {data,error}=await createUserClient(url,publishable,token).rpc('save_payment_settings',{p_cipher:encrypt(next),p_version:version,p_request:requestId});check(error);
  if(next.mode!=='GATEWAY'||!syncBank||!context)return data;
  try{const saved=await read(token);if(saved.version!==Number(data.version)||saved.value.mode!=='GATEWAY')return {...data,bankLinkStatus:'UNKNOWN'};const bankLinkStatus=await syncBank({orgId:context.orgId,bankCode:saved.value.bankCode,number:saved.value.accountNumber,name:saved.value.accountName,version:saved.version},requestId);return {...data,bankLinkStatus};}catch{return {...data,bankLinkStatus:'UNKNOWN'};}
 }
 };
}
export type PaymentSettingsService=ReturnType<typeof createPaymentSettingsService>;

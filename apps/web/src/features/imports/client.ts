import { z } from 'zod';
import { auth,request,RequestError } from '../../lib/client';
const row=z.object({row:z.number(),barcode:z.string(),name:z.string(),category:z.string(),salePrice:z.string(),unitCost:z.string(),quantity:z.number()});
export const batchSchema=z.object({batchId:z.uuid(),expiresAt:z.string(),rows:z.array(row),errors:z.array(z.object({row:z.number(),message:z.string()})),status:z.enum(['READY','INVALID','COMMITTED']),importedCount:z.number()});
export type Batch=z.infer<typeof batchSchema>;
async function token(){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new RequestError('กรุณาเข้าสู่ระบบ',401);return data.session.access_token;}
export async function previewImport(file:File){const body=new FormData();body.append('file',file);const response=await fetch('/api/v1/inventory/import/preview',{method:'POST',headers:{Authorization:`Bearer ${await token()}`},body});const result=await response.json();if(!response.ok)throw new RequestError(result.error?.message??'ตรวจไฟล์ไม่สำเร็จ',response.status);return batchSchema.parse(result.data);}
export async function commitImport(id:string){return batchSchema.parse(await request(`/inventory/import/${id}/commit`,await token(),{}));}
export async function getImport(id:string){return batchSchema.parse(await request(`/inventory/import/${id}`,await token()));}
async function pendingKey(){const {data}=await auth.auth.getSession();if(!data.session)throw new RequestError('กรุณาเข้าสู่ระบบ',401);return `pos:pending-import:${data.session.user.id}`;}
export async function rememberImport(id:string){localStorage.setItem(await pendingKey(),id);}
export async function forgetImport(){localStorage.removeItem(await pendingKey());}
export async function pendingImport(){const id=localStorage.getItem(await pendingKey());return id?getImport(id):null;}
export async function downloadTemplate(){const response=await fetch('/api/v1/inventory/import/template',{headers:{Authorization:`Bearer ${await token()}`}});if(!response.ok){const result=await response.json();throw new RequestError(result.error?.message??'ดาวน์โหลดไม่สำเร็จ',response.status);}const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='product-import-template.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

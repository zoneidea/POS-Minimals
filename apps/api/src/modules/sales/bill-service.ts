import { createUserClient } from '../../infra/supabase/user-client.js';
import { ApiError } from '../../infra/errors.js';
import { storedSale } from './checkout-schema.js';
import { snapshotCipher } from './snapshot-cipher.js';
import { saleList } from './void-schema.js';
import { reportRange,type ReportQuery } from '../reports/schema.js';
export function createBillService(url:string,key:string,encryptionKey:string){const cipher=snapshotCipher(encryptionKey);
 async function rpc(token:string,args:Record<string,unknown>){const {data,error}=await createUserClient(url,key,token).rpc('sale_bill_view',args);if(error)throw new ApiError(error.code==='PT404'?404:error.code==='PT403'?403:503,error.code==='PT404'?'NOT_FOUND':error.code==='PT403'?'FORBIDDEN':'SERVICE_UNAVAILABLE','โหลดข้อมูลบิลไม่สำเร็จ');return data;}
 return {
 async list(token:string,page:number,query?:ReportQuery&{period?:string}){const range=query?reportRange(query):null;if(query&&!range)throw new ApiError(400,'INVALID_DATE_RANGE','ช่วงวันที่ไม่ถูกต้อง');const data=await rpc(token,{p_id:null,p_page:page,p_from:range?.from??null,p_to:range?.to??null,p_group:query?.groupBy??'day',p_period:query?.period??null,p_cashier:query?.cashierId??null});return saleList.parse({...data,items:data.items.map((row:Record<string,unknown>)=>{const {identityCipher,...rest}=row;return {...rest,cashierName:cipher.decrypt(String(identityCipher)).cashierName};})});},
 async receipt(token:string,id:string){const data=await rpc(token,{p_id:id});const {identityCipher,...sale}=storedSale.parse(data.sale),identity=cipher.decrypt(identityCipher);return {status:data.status,voidedAtUtc:data.voidedAtUtc,voidReason:data.voidReason,sale:{...sale,receipt:{...sale.receipt,store:{name:identity.storeName},cashierName:identity.cashierName}}};}
 };
}
export type BillService=ReturnType<typeof createBillService>;

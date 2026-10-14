import { z } from 'zod';
import {auth,request} from '../../lib/client';
const activity=z.object({id:z.uuid(),action:z.string(),entityId:z.uuid(),actorUsername:z.string().nullable(),requestId:z.uuid(),createdAt:z.iso.datetime({offset:true})});
const result=z.object({items:z.array(activity),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.literal(10)});
export type Activity=z.infer<typeof activity>;
export const actionLabels:Record<string,string>={PAYMENT_SETTINGS_UPDATE:'ตั้งค่าการรับเงิน',ORG_BOOTSTRAPPED:'สร้างร้าน',CATEGORY_CREATE:'เพิ่มหมวดหมู่',CATEGORY_UPDATE:'แก้ไขหมวดหมู่',CATEGORY_DELETE:'ลบหมวดหมู่',PRODUCT_CREATE:'เพิ่มสินค้า',PRODUCT_UPDATE:'แก้ไขสินค้า',PRODUCT_DELETE:'ลบสินค้า',PRODUCT_IMAGE_UPDATED:'เปลี่ยนรูปสินค้า',STOCK_ADJUST:'ปรับสต็อก',SALE_COMPLETED:'ขายสินค้า',SALE_VOIDED:'ยกเลิกการขาย',STORE_SETTINGS_UPDATE:'แก้ไขข้อมูลร้าน',STAFF_UPDATE:'แก้ไขสิทธิ์/สถานะสมาชิก',STAFF_INVITED:'เชิญสมาชิก',STAFF_ACCEPTED:'รับคำเชิญ',INVENTORY_IMPORTED:'นำเข้าสินค้า'};
export async function listActivities(page:number,action:string,signal:AbortSignal){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return result.parse(await request(`/audits/activity-logs?page=${page}${action?`&action=${encodeURIComponent(action)}`:''}`,data.session.access_token,undefined,signal));}

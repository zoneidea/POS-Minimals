import type { ContactSync } from './reservepay.js';
import { encryptStoreContact,decryptStorePhone } from './contact-cipher.js';
import { contactEmailSchema } from './schema.js';
import { ApiError } from '../../infra/errors.js';
import { createUserClient, verifyUser } from '../../infra/supabase/user-client.js';
import { provisionOrganization } from './repository.js';
import type { BootstrapOrganization } from './schema.js';
export function createBootstrapService(url: string, key: string, encryptionKey: string, syncContact?:ContactSync): BootstrapOrganization {
  return async (token, input, requestId) => {
    const client = createUserClient(url, key, token);
    const user = await verifyUser(client, token);
    if (!user.email_confirmed_at) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'กรุณายืนยันอีเมลก่อนสร้างร้าน');
    if (!contactEmailSchema.safeParse(user.email).success) throw new ApiError(400, 'VALIDATION_ERROR', 'กรุณาระบุอีเมลบัญชีที่ถูกต้อง');
    const result=await provisionOrganization(client, input, requestId, encryptStoreContact(input.phone, encryptionKey));
    if(!syncContact)return result;
    const {data:settings,error}=await client.from('store_settings').select('store_name,private_cipher,phone').eq('org_id',result.orgId).is('deleted_at',null).single();
    if(error||!settings)return {...result,reservePayStatus:'UNKNOWN' as const};
    let phone:string;try{phone=settings.private_cipher?decryptStorePhone(settings.private_cipher,encryptionKey):settings.phone??'';}catch{return {...result,reservePayStatus:'UNKNOWN' as const};}
    const reservePayStatus=await syncContact({orgId:result.orgId,email:user.email!,phone,storeName:settings.store_name},requestId);
    return {...result,reservePayStatus};
  };
}

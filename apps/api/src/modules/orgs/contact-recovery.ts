import {z} from 'zod';
import {createUserClient,verifyUser} from '../../infra/supabase/user-client.js';
import type {UserContext} from '../auth/types.js';
import {decryptStorePhone} from './contact-cipher.js';
import {readProviderError} from './reservepay-diagnostic.js';
import type {ReservePayStatus,StoreContact} from './reservepay.js';

/** Reconcile against the current merchant account; a historical SENT ledger may belong to test mode. */
export function createContactEnsure(apiKey:string|undefined,send:typeof fetch=fetch){return async(contact:StoreContact):Promise<ReservePayStatus>=>{
 if(!apiKey)return 'NOT_CONFIGURED';
 const call=(endpoint:string,body:unknown)=>send(`https://api.reservepay.com/merchants/${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Api-Version':'2025-04-01','Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(4000),redirect:'error'});
 const lookup=async()=>{const response=await call('retrieve-contact',{contact_id:contact.orgId});if(response.ok){const parsed=z.object({contact_id:z.string().min(1),external_id:z.literal(contact.orgId)}).safeParse(await response.json());return parsed.success?'FOUND':'UNKNOWN';}const diagnostic=await readProviderError(response,contact,apiKey);return diagnostic.messages.includes('NOT_FOUND')?'ABSENT':'UNKNOWN';};
 try{
  const existing=await lookup();if(existing==='FOUND')return 'SENT';if(existing!=='ABSENT')return 'UNKNOWN';
  const response=await call('add-contact',{external_id:contact.orgId,contact_email:contact.email,contact_mobile:contact.phone,contact_name:contact.storeName,favorite:false});
  // Reconcile even after a rejected response: another request may have created the same external ID.
  await response.body?.cancel();
  return await lookup()==='FOUND'?'SENT':response.ok?'UNKNOWN':'FAILED';
 }catch{return 'UNKNOWN';}
};}
export function createContactRecovery(url:string,key:string,hex:string,apiKey:string|undefined,send:typeof fetch=fetch){
 const ensure=createContactEnsure(apiKey,send);
 return async(token:string,context:UserContext):Promise<ReservePayStatus>=>{
  if(context.role!=='OWNER')return 'FAILED';
  try{const client=createUserClient(url,key,token),user=await verifyUser(client,token);if(user.id!==context.userId||!user.email||!user.email_confirmed_at)return 'FAILED';
   const {data,error}=await client.from('store_settings').select('store_name,private_cipher,phone').eq('org_id',context.orgId).is('deleted_at',null).single();if(error||!data)return 'UNKNOWN';
   const phone=data.private_cipher?decryptStorePhone(data.private_cipher,hex):data.phone??'';
   if(!phone)return 'FAILED';
   return await ensure({orgId:context.orgId,email:user.email,phone,storeName:data.store_name});
  }catch{return 'UNKNOWN';}
 };
}
export type ContactRecovery=ReturnType<typeof createContactRecovery>;

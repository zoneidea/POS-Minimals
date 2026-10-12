import { z } from 'zod';
import { auth,request } from '../../lib/client';
import { settingsInput } from './schema';
export type Settings=z.infer<typeof settingsInput>;
export const member=z.object({id:z.uuid(),alias:z.string(),role:z.enum(['OWNER','EMPLOYEE','ACCOUNTANT']),status:z.enum(['INVITED','ACTIVE','SUSPENDED']),version:z.number().int().positive()});
export type Member=z.infer<typeof member>;
export async function call(path:string,body?:unknown,method?:'PATCH'|'POST',signal?:AbortSignal){const {data,error}=await auth.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Session required');return request(path,data.session.access_token,body,signal,method);}
export async function getSettings(signal?:AbortSignal){return settingsInput.parse(await call('/settings/store',undefined,undefined,signal));}
export async function getMembers(page:number,signal?:AbortSignal){return z.object({items:z.array(member),total:z.number().int().nonnegative()}).parse(await call(`/users?page=${page}`,undefined,undefined,signal));}

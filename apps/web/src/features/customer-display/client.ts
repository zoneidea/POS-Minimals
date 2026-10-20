import {z} from 'zod';
import {agentCall,AgentRequestError} from '../printing/agent-client';
import type {CustomerFrame} from './model';
export const displayPreferenceKey='pos:customer-display:v1';
export const deviceSettingsEvent='pos:device-settings-changed';
const preference=z.object({enabled:z.boolean(),displayId:z.string().max(80)}).strict();
export type DisplayPreference=z.infer<typeof preference>;
export function displayPreference():DisplayPreference{try{const value=localStorage.getItem(displayPreferenceKey);return value?preference.parse(JSON.parse(value)):{enabled:false,displayId:''};}catch{return {enabled:false,displayId:''};}}
export function saveDisplayPreference(value:DisplayPreference){localStorage.setItem(displayPreferenceKey,JSON.stringify(preference.parse(value)));window.dispatchEvent(new Event(deviceSettingsEvent));}
const displaysSchema=z.object({displays:z.array(z.object({id:z.string(),label:z.string(),width:z.number().int().positive(),height:z.number().int().positive(),primary:z.boolean()})),enabled:z.boolean(),displayId:z.string().nullable()});
async function displayCall(path:string,token:string,body?:unknown,keepalive=false){try{return await agentCall(path,token,body,{timeoutMs:3000,keepalive});}catch(error){if(error instanceof AgentRequestError&&error.status===404)throw new Error('กรุณาติดตั้ง Print Agent 1.1.0 หรือใหม่กว่าเพื่อใช้งานจอลูกค้า');throw error;}}
export async function agentDisplays(token:string){return displaysSchema.parse(await displayCall('/displays',token));}
export async function configureCustomerDisplay(token:string,value:DisplayPreference){return z.object({enabled:z.boolean(),displayId:z.string().nullable()}).parse(await displayCall('/customer-display/configure',token,value));}
export async function sendCustomerFrame(token:string,sessionId:string,sequence:number,frame:CustomerFrame){return z.object({displayed:z.literal(true)}).parse(await displayCall('/customer-display/state',token,{sessionId,sequence,frame}));}
export async function releaseCustomerDisplay(token:string,sessionId:string){return displayCall('/customer-display/release',token,{sessionId},true);}

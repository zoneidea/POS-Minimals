import type { StoreContact } from './reservepay.js';
export function safeProviderError(raw:string,contact:StoreContact,key:string){
 const redact=(text:string)=>{let value=text;for(const secret of [key,contact.orgId,contact.email,contact.phone,contact.storeName,...contact.storeName.split(/\s+/).filter(v=>v.length>2)].filter(Boolean))value=value.split(secret).join('[redacted]');return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').replace(/(?:\+?\d[\d\s()-]{7,}\d)/g,'[number]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,500);};
 try{const data=JSON.parse(raw),messages:string[]=[];
  const visit=(value:unknown,depth=0)=>{if(depth>4||messages.length>=4)return;if(typeof value==='string'){messages.push(redact(value));return;}if(Array.isArray(value)){for(const item of value.slice(0,4))visit(item,depth+1);return;}if(value&&typeof value==='object')for(const [field,item] of Object.entries(value))if(['message','error','errors','detail','reason','code','external_id','contact_email','contact_mobile','contact_name','favorite'].includes(field))visit(item,depth+1);};
  visit(data);return {kind:'HTTP_ERROR',messages:messages.length?messages:['No supported error fields in response']};
 }catch{return {kind:'HTTP_ERROR',messages:['Response is not valid JSON or exceeded diagnostic limit']};}
}
export async function readProviderError(response:Response,contact:StoreContact,key:string){
 const reader=response.body?.getReader();if(!reader)return {kind:'HTTP_ERROR',messages:['Empty response body']};let bytes=0,text='';const decoder=new TextDecoder();
 try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.length;if(bytes>16384)return {kind:'HTTP_ERROR',messages:['Response exceeded diagnostic limit']};text+=decoder.decode(chunk.value,{stream:true});}return safeProviderError(text+decoder.decode(),contact,key);}finally{await reader.cancel().catch(()=>{});}
}
export type ProviderDiagnostic=ReturnType<typeof safeProviderError>;

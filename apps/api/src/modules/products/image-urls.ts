import { createHash } from 'node:crypto';
import type { createUserClient } from '../../infra/supabase/user-client.js';
export const PRODUCT_IMAGE_BUCKET='product-images';
export const IMAGE_URL_SECONDS=900;
const REUSE_MS=600000,MAX_ENTRIES=512;
// Call only after live JWT/membership and current product reads. Never cache authorization.
export function createImageUrlSigner(now=Date.now){
 const cache=new Map<string,{url:string;until:number}>();
 return async(client:ReturnType<typeof createUserClient>,paths:string[],token:string)=>{
  const scope=createHash('sha256').update(token).digest('hex');
  const result=new Map<string,string>(),missing:string[]=[],started=now();
  for(const [key,value]of cache)if(value.until<=started)cache.delete(key);
  for(const path of new Set(paths)){
   const key=`${scope}:${path}`,entry=cache.get(key);
   if(entry){cache.delete(key);cache.set(key,entry);result.set(path,entry.url);}else missing.push(path);
  }
  if(!missing.length)return result;
  const {data,error}=await client.storage.from(PRODUCT_IMAGE_BUCKET).createSignedUrls(missing,IMAGE_URL_SECONDS);
  if(error)return result;
  for(const row of data??[]){if(!row.path||!row.signedUrl||row.error)continue;
   result.set(row.path,row.signedUrl);
   // Conservative issue time plus five-minute validity reserve for lazy image loads.
   if(now()<started+REUSE_MS){cache.set(`${scope}:${row.path}`,{url:row.signedUrl,until:started+REUSE_MS});
    while(cache.size>MAX_ENTRIES)cache.delete(cache.keys().next().value!);}
  }
  return result;
 };
}
export const signProductImages=createImageUrlSigner();

import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { appendFile,mkdir } from 'node:fs/promises';
import { createProductThumbnail } from '../apps/api/src/modules/products/image.js';
// Offline maintenance only: privileged Storage access is never used by ordinary API reads.
if(!['development','staging'].includes(process.env.DB_ENVIRONMENT??''))throw new Error('Confirm development/staging target with DB_ENVIRONMENT');
if(!process.env.DATABASE_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw new Error('Server-only database and Storage configuration required');
const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}).storage.from('product-images');
const counts={generated:0,skipped:0,failed:0};
try{
 await db.connect();
 const products=(await db.query<{id:string;org_id:string;image_path:string;row_version:string;owner_id:string}>(`select p.id,p.org_id,p.image_path,p.row_version,m.user_id as owner_id
 from public.products p join public.organizations o on o.id=p.org_id
 join public.organization_members m on m.org_id=p.org_id and m.role='OWNER' and m.status='ACTIVE' and m.deleted_at is null
 where p.deleted_at is null and p.image_path is not null and p.image_thumbnail_path is null and o.status='ACTIVE' and o.deleted_at is null
 order by p.id`)).rows;
 for(const product of products){
  // Storage download/resize/upload stay outside the transaction and row lock.
  let transaction=false;
  try{
   const {data,error}=await storage.download(product.image_path);if(error||!data)throw new Error('Download failed');
   const thumbnail=await createProductThumbnail(Buffer.from(await data.arrayBuffer()));
   const path=`${product.org_id}/${product.id}/${randomUUID()}.webp`;
   const {error:upload}=await storage.upload(path,thumbnail,{contentType:'image/webp',cacheControl:'900',upsert:false});if(upload)throw new Error('Thumbnail upload failed');
   await db.query('begin');transaction=true;
   const current=(await db.query('select image_path,image_thumbnail_path,row_version from public.products where id=$1 and org_id=$2 and deleted_at is null for update',[product.id,product.org_id])).rows[0];
   if(!current||current.image_thumbnail_path||current.image_path!==product.image_path){counts.skipped++;await db.query('rollback');transaction=false;continue;}
   await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[product.owner_id]);
   await db.query('select public.set_product_image($1,$2,$3,$4,$5)',[product.id,product.image_path,current.row_version,randomUUID(),path]);
   await db.query('commit');transaction=false;counts.generated++;
  }catch{if(transaction)await db.query('rollback');counts.failed++;throw new Error('Thumbnail maintenance failed');}
 }
}catch{process.exitCode=1;process.stderr.write('Thumbnail backfill stopped; no credentials or customer data logged.\n');}
finally{await db.end();await mkdir('logs',{recursive:true});await appendFile('logs/thumbnail-backfill.jsonl',JSON.stringify({at:new Date().toISOString(),event:'product_thumbnail_backfill',...counts})+'\n');console.log(JSON.stringify(counts));}

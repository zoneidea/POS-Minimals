import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { bootstrapRequestSchema, contactEmailSchema, contactPhoneSchema } from '../packages/contracts/src/index.js';
import { encryptStoreContact } from '../apps/api/src/modules/orgs/contact-cipher.js';
describe('required store contact',()=>{
 it('rejects missing or malformed contact and accepts local/international telephone',()=>{
  for(const phone of ['', '12345', '081abc5678', '081-234-5678']) expect(contactPhoneSchema.safeParse(phone).success).toBe(false);
  for(const phone of ['0812345678','021234567','+66812345678']) expect(contactPhoneSchema.safeParse(phone).success).toBe(true);
  for(const email of ['', 'name', 'name@']) expect(contactEmailSchema.safeParse(email).success).toBe(false);
  expect(contactEmailSchema.safeParse('owner@example.com').success).toBe(true);
  expect(bootstrapRequestSchema.safeParse({storeName:'Shop',displayUsername:'Owner'}).success).toBe(false);
 });
 it('stores encrypted contact atomically, preserves retries and denies anonymous access',async()=>{
  const db=new PGlite(); const uid='00000000-0000-4000-8000-000000000001', request='10000000-0000-4000-8000-000000000001';
  try{
   await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));
   await db.exec(readFileSync('supabase/migrations/202610110001_identity_tenants.sql','utf8'));
   await db.exec('alter table public.store_settings add column private_cipher text');
   await db.exec(readFileSync('supabase/migrations/202610140002_bootstrap_contact.sql','utf8'));
   await db.query('insert into auth.users values($1,now())',[uid]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
   const key='ab'.repeat(32), encrypted=encryptStoreContact('0812345678',key);
   expect(encrypted).not.toContain('0812345678');
   await db.exec('set role authenticated');
   const call=()=>db.query('select public.bootstrap_org_with_contact($1,$2,$3,$4) as data',['Shop','Owner',request,encrypted]);
   const first=await call();expect((await call()).rows).toEqual(first.rows);
   const settings=await db.query<{phone:string|null;private_cipher:string}>('select phone,private_cipher from public.store_settings');
   expect(settings.rows).toHaveLength(1);expect(settings.rows[0]!.phone).toBeNull();
   const [,iv,tag,data]=settings.rows[0]!.private_cipher.split('.');
   const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(iv!,'base64'));decipher.setAAD(Buffer.from('pos:store-private:v1'));decipher.setAuthTag(Buffer.from(tag!,'base64'));
   expect(JSON.parse(Buffer.concat([decipher.update(Buffer.from(data!,'base64')),decipher.final()]).toString()).phone).toBe('0812345678');
   expect((await db.query('select * from public.activity_logs')).rows).toHaveLength(1);
   await db.exec('reset role; set role anon');await expect(call()).rejects.toThrow();
  }finally{await db.close();}
 },15000);
});

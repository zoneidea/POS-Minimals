import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('keeps session bindings private, tenant-associated and unique even across stores',async()=>{const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table public.organizations(id uuid primary key);');
 await db.exec(readFileSync('supabase/migrations/202610150002_reservepay_payment_sessions.sql','utf8'));
 const org='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002';await db.query('insert into organizations values ($1)',[org]);
 await db.query('insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor) values ($1,$2,$3,$4,$5)',['a'.repeat(64),org,user,'hash','4400']);
 await expect(db.query('insert into reservepay_payment_sessions(session_hash,org_id,user_id,quote_hash,amount_minor) values ($1,$2,$3,$4,$5)',['a'.repeat(64),org,user,'other','4400'])).rejects.toMatchObject({code:'23505'});
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await expect(db.query('select * from reservepay_payment_sessions')).rejects.toMatchObject({code:'42501'});await db.exec('reset role');}
 await db.exec('set role service_role');expect((await db.query('select * from reservepay_payment_sessions')).rows).toHaveLength(1);await expect(db.query('delete from reservepay_payment_sessions')).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}},15000);

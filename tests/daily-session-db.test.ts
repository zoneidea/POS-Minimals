import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('returns Thai calendar midnight only for the JWT owner/session and denies anonymous access',async()=>{const db=new PGlite();try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));await db.exec(readFileSync('supabase/migrations/202610150001_daily_session_expiry.sql','utf8'));
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',sid='00000000-0000-4000-8000-000000000003';await db.query('insert into auth.users values($1,now()),($2,now())',[a,b]);await db.query("insert into auth.sessions values($1,$2,'2026-10-15T16:59:59Z')",[sid,a]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({session_id:sid})]);
 const call=()=>db.query<{expiry:Date}>('select public.current_session_expires_at() as expiry');expect(new Date((await call()).rows[0]!.expiry).toISOString()).toBe('2026-10-15T17:00:00.000Z');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);await expect(call()).rejects.toMatchObject({code:'PT401'});await db.exec('reset role');await db.query("update auth.sessions set created_at='2026-10-15T17:00:00Z' where id=$1",[sid]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);expect(new Date((await call()).rows[0]!.expiry).toISOString()).toBe('2026-10-16T17:00:00.000Z');await db.exec('set role anon');await expect(call()).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}},15000);

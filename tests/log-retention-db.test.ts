import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
import {expect,it} from 'vitest';
it('retains recent logs, expires older logs and denies browser log writes/purge',async()=>{
 const db=new PGlite({extensions:{pg_trgm}});try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const file of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const user='10000000-0000-4000-8000-000000000001';await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[user]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);const org=(await db.query<{org:string}>("select public.bootstrap_org('Shop','Owner',$1)->>'orgId' org",[user])).rows[0]!.org;
 await db.query("insert into public.activity_logs(org_id,actor_user_id,action,entity_id,request_id,created_at) values($1,$2,'OLD',$2,$2,now()-interval '31 days')",[org,user]);
 await db.query("select public.record_request_log($1,'GET','/api/v1/sales/:id',200,10)",[user]);await db.exec("insert into private.request_logs(request_id,method,route,status,duration_ms,created_at) select request_id,method,route,status,duration_ms,now()-interval '31 days' from private.request_logs");
 const before=(await db.query('select id from public.organizations')).rows;
 expect((await db.query<{result:{requestLogs:number;activityLogs:number}}>('select private.purge_expired_logs() result')).rows[0]!.result).toEqual({requestLogs:1,activityLogs:1});
 expect((await db.query('select id from private.request_logs')).rows).toHaveLength(1);expect((await db.query('select id from public.organizations')).rows).toEqual(before);
 await db.exec('set role authenticated');await expect(db.query("select public.record_request_log($1,'GET','/api/v1/sales',200,1)",[user])).rejects.toThrow();await expect(db.exec('select private.purge_expired_logs()')).rejects.toThrow();await expect(db.exec('select * from private.request_logs')).rejects.toThrow();
 }finally{await db.close();}
},30000);

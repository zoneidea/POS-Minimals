import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { DatabaseInitializer } from '../scripts/database-initializer.js';
const ids = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const a = ids[0]!; const b = ids[1]!; const employee = ids[2]!; const accountant = ids[3]!;
const suspended = ids[4]!; const unverified = ids[5]!; const fresh = ids[6]!;
const requestId = '10000000-0000-4000-8000-000000000001';
let db: PGlite; let orgA: string; let orgB: string;
async function asUser<T>(userId: string, action: () => Promise<T>, role = 'authenticated'): Promise<T> {
  await db.exec('begin');
  try {
    // Roles here are fixed test constants, never an API input.
    await db.exec(role === 'anon' ? 'set local role anon' : 'set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await action();
    await db.exec('commit'); return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
async function bootstrap(name = 'ร้านทดสอบ', username = 'ชื่อซ้ำได้') {
  const r = await db.query<{ result: { orgId: string; role: string; status: string } }>(
    'select public.bootstrap_org($1, $2, $3) as result', [name, username, requestId]);
  return r.rows[0]!.result;
}
beforeAll(async () => {
  db = new PGlite({extensions:{pg_trgm}});
  await db.exec(readFileSync('supabase/tests/auth-fixture.sql', 'utf8'));
  const initializer = new DatabaseInitializer({ query: async (sql, params) => {
    if (params?.length) return db.query(sql, params);
    const results = await db.exec(sql); return { rows: results.at(-1)?.rows ?? [] };
  } }, 'supabase/migrations');
  expect(await initializer.apply()).toEqual(['202610110001_identity_tenants.sql','202610120001_categories.sql','202610120002_products.sql','202610120003_stock_movements.sql','202610120004_pos_catalog.sql','202610120005_cash_quote.sql','202610120006_cash_checkout.sql','202610120007_product_images.sql','202610120008_sale_void.sql','202610120009_store_staff.sql','202610120010_invite_context.sql','202610120011_reports_dashboard.sql','202610120012_dashboard_product_ranking.sql','202610120013_inventory_import.sql','202610120014_sale_bill_views.sql','202610130001_dashboard_product_charts.sql','202610130002_dashboard_idle_products.sql','202610130003_daily_sales_access.sql','202610130004_product_creation_sale_span.sql','202610130005_unsold_product_span.sql','202610130006_read_performance.sql']);
  expect(await initializer.apply()).toEqual([]);
  for (const id of ids) await db.query('insert into auth.users(id, email_confirmed_at) values ($1, $2)', [id, id === unverified ? null : new Date()]);
  orgA = (await asUser(a, () => bootstrap('ร้าน A'))).orgId;
  orgB = (await asUser(b, () => bootstrap('ร้าน B'))).orgId;
  for (const [id, role, status] of [[employee, 'EMPLOYEE', 'ACTIVE'], [accountant, 'ACCOUNTANT', 'ACTIVE'], [suspended, 'EMPLOYEE', 'SUSPENDED']]) {
    await db.query('insert into public.organization_members(org_id, user_id, display_username, role, status) values ($1,$2,$3,$4,$5)', [orgA,id,'ชื่อซ้ำได้',role,status]);
  }
}, 30000);
afterAll(async () => { await db?.close(); });
describe('PostgreSQL identity migration and RLS', () => {
  it('provisions owner, org, settings and one audit event atomically', async () => {
    const result = await asUser(a, () => bootstrap());
    expect(result).toEqual({ orgId: orgA, role: 'OWNER', status: 'ACTIVE' });
    const counts = await db.query<{ n: number }>('select count(*)::int as n from public.activity_logs where org_id = $1', [orgA]);
    expect(counts.rows[0]!.n).toBe(1);
    const settings = await asUser(a, () => db.query<{ vat_enabled: boolean; vat_rate: string }>('select vat_enabled,vat_rate from public.store_settings'));
    expect(settings.rows[0]).toMatchObject({ vat_enabled: false, vat_rate: '7.00' });
  });
  it('ten retries return one org without changing initial snapshots', async () => {
    for (let i = 0; i < 10; i++) expect((await asUser(a, () => bootstrap('เปลี่ยนชื่อ'))).orgId).toBe(orgA);
    const organizations = await db.query<{ name: string }>('select name from public.organizations where id = $1',[orgA]);
    expect(organizations.rows[0]!.name).toBe('ร้าน A');
    expect((await db.query<{ n: number }>('select count(*)::int as n from public.organizations')).rows[0]!.n).toBe(2);
  });
  it('allows duplicate display usernames across users and orgs', async () => {
    const result = await db.query<{ n: number }>('select count(*)::int as n from public.organization_members where display_username = $1',['ชื่อซ้ำได้']);
    expect(result.rows[0]!.n).toBe(5);
  });
  it.each([a,b,employee,accountant])('organization SELECT is tenant-isolated for %s', async (id) => {
    const result = await asUser(id, () => db.query<{ id: string }>('select id from public.organizations'));
    expect(result.rows).toEqual([{ id: id === b ? orgB : orgA }]);
  });
  it('cross-org settings and guessed memberships are hidden', async () => {
    const result = await asUser(a, () => db.query('select * from public.store_settings where org_id = $1',[orgB]));
    expect(result.rows).toEqual([]);
    const members = await asUser(a, () => db.query('select * from public.organization_members where org_id = $1',[orgB]));
    expect(members.rows).toEqual([]);
  });
  it.each([employee,accountant])('non-owner cannot read sensitive settings or audit %s', async (id) => {
    expect((await asUser(id, () => db.query('select * from public.store_settings'))).rows).toEqual([]);
    expect((await asUser(id, () => db.query('select * from public.activity_logs'))).rows).toEqual([]);
    expect((await asUser(id, () => db.query('select * from public.organization_members'))).rows).toHaveLength(1);
  });
  it('suspended and unprovisioned users cannot read any tenant data', async () => {
    for (const id of [suspended,fresh]) {
      expect((await asUser(id, () => db.query('select * from public.organizations'))).rows).toEqual([]);
      expect((await asUser(id, () => db.query('select * from public.organization_members'))).rows).toEqual([]);
    }
  });
  it.each(['organizations','organization_members','store_settings','activity_logs'])('direct INSERT/UPDATE/DELETE denied even to OWNER on %s', async (table) => {
    const privilege = await db.query<{ allowed: boolean }>("select has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') as allowed", [`public.${table}`]);
    expect(privilege.rows[0]!.allowed).toBe(false);
    await expect(asUser(a, () => db.query(`delete from public.${table}`))).rejects.toMatchObject({ code: '42501' });
  });
  it('anonymous callers cannot execute bootstrap or read membership', async () => {
    await expect(asUser('', () => bootstrap(), 'anon')).rejects.toMatchObject({ code: '42501' });
    await expect(asUser('', () => db.query('select * from public.organization_members'), 'anon')).rejects.toMatchObject({ code: '42501' });
  });
  it('no UID, unverified email, and malformed input are rejected', async () => {
    await expect(asUser('', () => bootstrap())).rejects.toMatchObject({ code: 'PT401' });
    await expect(asUser(unverified, () => bootstrap())).rejects.toMatchObject({ code: 'PT403' });
    await expect(asUser(fresh, () => bootstrap('   '))).rejects.toMatchObject({ code: 'PT400' });
  });
  it('existing employee/accountant cannot bootstrap a second org', async () => {
    for (const id of [employee,accountant]) await expect(asUser(id, () => bootstrap())).rejects.toMatchObject({ code: 'PT409' });
  });
  it('suspended users cannot bypass suspension by bootstrapping', async () => {
    await expect(asUser(suspended, () => bootstrap())).rejects.toMatchObject({ code: 'PT403' });
  });
  it('one active membership per user is enforced across orgs', async () => {
    await expect(db.query('insert into public.organization_members(org_id,user_id,display_username,role) values($1,$2,$3,$4)',[orgB,employee,'duplicate','EMPLOYEE'])).rejects.toMatchObject({ code: '23505' });
  });
  it('failure midway leaves no orphan organization, membership or audit', async () => {
    await db.exec("alter table public.store_settings add constraint test_failure check (store_name <> 'FAIL')");
    await expect(asUser(fresh, () => bootstrap('FAIL'))).rejects.toMatchObject({ code: '23514' });
    expect((await db.query('select * from public.organizations where name = $1',['FAIL'])).rows).toHaveLength(0);
    expect((await db.query('select * from public.organization_members where user_id = $1',[fresh])).rows).toHaveLength(0);
    expect((await db.query('select * from public.activity_logs where actor_user_id = $1',[fresh])).rows).toHaveLength(0);
    await db.exec('alter table public.store_settings drop constraint test_failure');
    const retry = await asUser(fresh, () => bootstrap('ร้านใหม่'));
    expect(retry.role).toBe('OWNER');
  });
  it('organization suspension immediately hides all context', async () => {
    await db.query("update public.organizations set status = 'SUSPENDED' where id = $1",[orgB]);
    expect((await asUser(b, () => db.query('select * from public.organization_members'))).rows).toEqual([]);
    await expect(asUser(b, () => bootstrap())).rejects.toMatchObject({ code: 'PT403' });
    await db.query("update public.organizations set status = 'ACTIVE' where id = $1",[orgB]);
  });
});

describe('Category RLS and transactional mutations',()=>{
 let categoryA:string;
 const mutate=async(operation:string,id:string|null,name:string|null)=>{
  const result=await db.query<{result:{id:string;name:string}}>('select public.manage_category($1,$2,$3,$4) as result',[operation,id,name,requestId]);return result.rows[0]!.result;
 };
 it('creates trimmed category with activity atomically',async()=>{const created=await asUser(a,()=>mutate('create',null,' Drinks '));categoryA=created.id;expect(created.name).toBe('Drinks');expect((await db.query('select * from public.activity_logs where entity_id=$1',[categoryA])).rows).toHaveLength(1);});
 it('rejects case-insensitive duplicates in one store but allows another store',async()=>{await expect(asUser(a,()=>mutate('create',null,' drinks '))).rejects.toMatchObject({code:'PT409'});await asUser(b,()=>mutate('create',null,'Drinks'));});
 it.each([employee,accountant,suspended])('denies mutation by %s',async id=>{await expect(asUser(id,()=>mutate('update',categoryA,'Changed'))).rejects.toMatchObject({code:'PT403'});});
 it('allows employee catalog reads but hides other tenant and accountant rows',async()=>{expect((await asUser(employee,()=>db.query('select id from public.categories'))).rows).toEqual([{id:categoryA}]);expect((await asUser(accountant,()=>db.query('select id from public.categories'))).rows).toEqual([]);await expect(asUser(b,()=>mutate('update',categoryA,'Other'))).rejects.toMatchObject({code:'PT404'});});
 it('denies direct owner writes and anonymous RPC',async()=>{await expect(asUser(a,()=>db.query('delete from public.categories'))).rejects.toMatchObject({code:'42501'});await expect(asUser('',()=>mutate('delete',categoryA,null),'anon')).rejects.toMatchObject({code:'42501'});});
 it('edits and soft deletes with retained history and reusable active name',async()=>{expect((await asUser(a,()=>mutate('update',categoryA,'Refreshments'))).name).toBe('Refreshments');await asUser(a,()=>mutate('delete',categoryA,null));expect((await asUser(a,()=>db.query('select id from public.categories where id=$1',[categoryA]))).rows).toEqual([]);expect((await db.query('select deleted_by from public.categories where id=$1',[categoryA])).rows[0]).toEqual({deleted_by:a});await asUser(a,()=>mutate('create',null,'Refreshments'));});
 it('blocks deleting a category referenced by an active product',async()=>{const item=await asUser(a,()=>mutate('create',null,'Used'));const product=await db.query<{id:string}>("insert into public.products(org_id,category_id,barcode,name) values($1,$2,'CATEGORY-GUARD','Guard') returning id",[orgA,item.id]);try{await expect(asUser(a,()=>mutate('delete',item.id,null))).rejects.toMatchObject({code:'PT409'});expect((await db.query('select deleted_at from public.categories where id=$1',[item.id])).rows[0]).toEqual({deleted_at:null});}finally{await db.query('delete from public.products where id=$1',[product.rows[0]!.id]);}});
});

it('joined identity read enforces active membership/shop and RLS for each role',async()=>{
 const joined=(uid:string,target=uid)=>asUser(uid,()=>db.query("select m.org_id,m.role,o.name from public.organization_members m join public.organizations o on o.id=m.org_id where m.user_id=$1 and m.status='ACTIVE' and m.deleted_at is null and o.status='ACTIVE' and o.deleted_at is null",[target]));
 for(const uid of [a,employee,accountant])expect((await joined(uid)).rows).toHaveLength(1);
 expect((await joined(employee,b)).rows).toEqual([]);expect((await joined(suspended)).rows).toEqual([]);
 await db.query("update public.organizations set status='SUSPENDED' where id=$1",[orgA]);
 for(const uid of [a,employee,accountant])expect((await joined(uid)).rows).toEqual([]);
 await db.query("update public.organizations set status='ACTIVE' where id=$1",[orgA]);
});

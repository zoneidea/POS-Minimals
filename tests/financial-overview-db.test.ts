import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFileSync,readdirSync} from 'node:fs';
it('financial overview uses filtered, immutable completed-sale costs and excludes VAT and voids',async()=>{
 const db=new PGlite({extensions:{pg_trgm}}),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',staff='00000000-0000-4000-8000-000000000003',account='00000000-0000-4000-8000-000000000004',req='10000000-0000-4000-8000-000000000001';
 const rpc=(uid:string,sql:string,args:unknown[]=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return (await tx.query<any>(sql+' r',args)).rows[0]?.r;});
 try{
 await db.exec(readFileSync('supabase/tests/auth-fixture.sql','utf8'));for(const n of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'));
 for(const id of [owner,other,staff,account])await db.query('insert into auth.users values($1,now())',[id]);
 const org=(await rpc(owner,"select bootstrap_org('Test','Owner',$1)",[req])).orgId;await rpc(other,"select bootstrap_org('Other','Other',$1)",[req]);
 for(const [id,role] of [[staff,'EMPLOYEE'],[account,'ACCOUNTANT']])await db.query("insert into organization_members(org_id,user_id,display_username,role) values($1,$2,'Staff',$3)",[org,id,role]);
 const product=await rpc(owner,"select create_product_with_stock('create',null,'001','Coffee',null,107,30,null,$1,20)",[req]);
 const checkout={items:[{productId:product.id,quantity:2,expectedUnitPrice:'107.00',expectedVersion:2}],discountAmount:'0.00',expectedTotalAmount:'214.00',payment:{method:'CASH',receivedAmount:'214.00'}};
 const sale=await rpc(staff,'select checkout_cash_sale($1,$2,$3,$4)',[JSON.stringify(checkout),req,req,'cipher']);
 // Seed VAT and fixed timestamps on this isolated fixture; no live data is changed.
 await db.query("update sales set completed_at='2026-10-18T16:59:59Z',vat_amount=14 where id=$1",[sale.saleId]);
 await db.query('update products set unit_cost=99 where id=$1',[product.id]);
 const report=(uid=owner,page=1,cashier:string|null=null,from='2026-10-17T17:00:00Z',to='2026-10-18T17:00:00Z')=>rpc(uid,"select report_data('sales',$1,$2,'day',$3,$4,10)",[from,to,cashier,page]);
 const expected={netSalesExVat:'200.00',cogs:'60.00',grossProfit:'140.00',grossMarginPercent:'70.00'};
 expect((await report()).financial).toEqual(expected);expect((await report(account,2,staff)).financial).toEqual(expected);
 expect((await report(owner,1,owner)).financial).toMatchObject({netSalesExVat:'0.00',cogs:'0.00',grossProfit:'0.00',grossMarginPercent:null});
 expect((await report(other)).financial.cogs).toBe('0.00');await expect(report(staff)).rejects.toMatchObject({code:'PT403'});
 expect((await report(owner,1,null,'2026-10-18T17:00:00Z','2026-10-19T17:00:00Z')).financial.netSalesExVat).toBe('0.00');
 // Loss and zero revenue are valid; avoid NaN/infinity in margin.
 await db.query('update sale_items set unit_cost=120 where sale_id=$1',[sale.saleId]);
 expect((await report()).financial).toMatchObject({grossProfit:'-40.00',grossMarginPercent:'-20.00'});
 await db.query("update sales set status='VOIDED',voided_at=now(),voided_by=$2,void_reason='Fixture' where id=$1",[sale.saleId,owner]);
 expect((await report()).financial).toEqual({netSalesExVat:'0.00',cogs:'0.00',grossProfit:'0.00',grossMarginPercent:null});
 await expect(db.exec("set role anon;select report_data('sales',now()-interval '1 day',now())")).rejects.toMatchObject({code:'42501'});
 }finally{await db.close();}
},30000);

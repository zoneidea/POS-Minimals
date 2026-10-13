import { z } from 'zod';
export const reportType=z.enum(['sales','inventory','low-stock','stock-valuation']);
export const dateOnly=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const ms=Date.parse(value+'T00:00:00Z');return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===value;});
export const reportQuery=z.object({from:dateOnly.optional(),to:dateOnly.optional(),groupBy:z.enum(['day','week','month','year']).default('day'),cashierId:z.uuid().optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export type ReportQuery=z.infer<typeof reportQuery>;
export function reportRange(query:ReportQuery){const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date()),from=query.from??today,to=query.to??today;const start=Date.parse(from+'T00:00:00+07:00'),end=Date.parse(to+'T00:00:00+07:00')+86400000;if(end<=start||end-start>366*86400000)return null;return {from:new Date(start).toISOString(),to:new Date(end).toISOString(),labelFrom:from,labelTo:to};}
const amount=z.string().regex(/^\d+\.\d{2}$/),count=z.number().int().nonnegative();
export const salesSummary=z.object({gross:amount,discount:amount,net:amount,vat:amount,billCount:count,voidCount:count,voidAmount:amount});
export const salesRow=salesSummary.extend({period:dateOnly});
export const inventorySummary=z.object({productCount:count,quantity:count,valuation:amount});
export const inventoryRow=z.object({id:z.uuid(),barcode:z.string(),name:z.string(),quantity:count,unitCost:amount,salePrice:amount,valuation:amount});
const meta={total:count,page:z.number().int().positive(),limit:z.number().int().positive()};
export const reportResult=z.discriminatedUnion('type',[z.object({type:z.literal('sales'),summary:salesSummary,items:z.array(salesRow),...meta}),z.object({type:z.enum(['inventory','low-stock','stock-valuation']),summary:inventorySummary,items:z.array(inventoryRow),...meta})]);
export const dashboardResult=z.object({todaySales:amount,monthSales:amount,todayBills:count,todayVoids:count,lowStockCount:count,dateBangkok:dateOnly,cashToday:amount,promptpayToday:amount,topProducts:z.array(z.object({productId:z.uuid(),name:z.string(),barcode:z.string(),quantity:count,net:amount}))});
export const cashiersResult=z.array(z.object({id:z.uuid(),alias:z.string()}));
export type ReportData=z.infer<typeof reportResult>;

export const rankingQuery=z.object({days:z.coerce.number().refine(value=>[7,15,30].includes(value)).default(7)}).strict();
const rankedProduct=z.object({productId:z.uuid(),name:z.string(),barcode:z.string(),quantity:count});
export const rankingsResult=z.object({days:z.number(),fromBangkok:dateOnly,toBangkok:dateOnly,topProducts:z.array(rankedProduct).max(5),slowProducts:z.array(rankedProduct.extend({stockQuantity:count})).max(5),idleProducts:z.array(z.object({productId:z.uuid(),name:z.string(),barcode:z.string(),stockQuantity:count,idleDays:count,sinceDate:dateOnly,lastSaleDate:dateOnly.optional()})).max(5).default([])});

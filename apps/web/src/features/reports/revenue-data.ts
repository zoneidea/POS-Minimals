import type { z } from 'zod';
import type { salesRow } from './schema';
export function revenueWindow(now=new Date()){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(now),[year,month]=today.split('-').map(Number);
 const months=Array.from({length:6},(_,index)=>new Date(Date.UTC(year!,month!-6+index,1)).toISOString().slice(0,10));
 return {from:months[0]!,to:today,months};
}
export function revenuePoints(months:string[],rows:z.infer<typeof salesRow>[]){
 const amounts=new Map(rows.map(row=>[row.period,row.net]));
 return months.map(period=>({period,amount:amounts.get(period)??'0.00',label:new Intl.DateTimeFormat('th-TH',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(period+'T00:00:00Z'))}));
}

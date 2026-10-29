import {cafeLineFields} from '@pos/contracts/cafe-options';
import {z} from 'zod';
const pending=z.object({sessionId:z.string(),amount:z.string(),cart:z.object({items:z.array(z.object({...cafeLineFields,productId:z.uuid(),quantity:z.number().int().positive()})),discountAmount:z.string(),couponCode:z.string().regex(/^[A-Z0-9_-]{3,32}$/).optional()})});
export function readGatewayPending(scope:string){try{const value=localStorage.getItem(`pos:gateway-pending:${scope}`);return value?pending.parse(JSON.parse(value)):null;}catch{return null;}}
export function saveGatewayPending(scope:string,value:z.infer<typeof pending>){localStorage.setItem(`pos:gateway-pending:${scope}`,JSON.stringify(pending.parse(value)));}
export function clearGatewayPending(scope:string){localStorage.removeItem(`pos:gateway-pending:${scope}`);}
/** Keep references for late-result reconciliation; the server retains the bound sale input. */
export function archiveExpiredGateway(scope:string,sessionId:string,amount:string){
 const key=`pos:gateway-expired:${scope}`,reference=z.object({sessionId:z.string(),amount:z.string(),verifiedAt:z.string()});
 const raw=localStorage.getItem(key),items=raw?z.array(reference).parse(JSON.parse(raw)):[];
 if(!items.some(item=>item.sessionId===sessionId))items.push({sessionId,amount,verifiedAt:new Date().toISOString()});
 localStorage.setItem(key,JSON.stringify(items));
}

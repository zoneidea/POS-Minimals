import {z} from 'zod';
import {cartSchema} from './cart';
import {pendingSaleKey} from './pending-sale';
const held=z.object({id:z.uuid(),createdAt:z.iso.datetime(),items:cartSchema.refine(items=>items.length>0)}).strict();
const schema=z.object({version:z.literal(1),revision:z.number().int().nonnegative(),items:cartSchema,bills:z.array(held).max(50)}).strict();
export type ParkedWorkspace=z.infer<typeof schema>;
export type ParkedBill=z.infer<typeof held>;
type CartStorage=Pick<Storage,'getItem'|'setItem'>;
export const parkedWorkspaceKey=(scope:string)=>`pos:parked-workspace:v1:${scope}`;
export function readParkedWorkspace(scope:string,storage:CartStorage=localStorage):ParkedWorkspace{
 const raw=storage.getItem(parkedWorkspaceKey(scope));
 if(raw)return schema.parse(JSON.parse(raw));
 const legacy=storage.getItem(`pos:cart:v1:${scope}`);
 return {version:1,revision:0,items:legacy?cartSchema.parse(JSON.parse(legacy)):[],bills:[]};
}
export function assertNoPendingPayment(scope:string,storage:CartStorage=localStorage){
 if(storage.getItem(pendingSaleKey(scope))||storage.getItem(`pos:gateway-pending:${scope}`))throw new Error('กรุณาตรวจสอบรายการชำระเงินเดิมก่อนพักหรือเรียกคืนบิล');
}
export function writeParkedWorkspace(scope:string,previous:ParkedWorkspace,next:ParkedWorkspace,storage:CartStorage=localStorage){
 const current=readParkedWorkspace(scope,storage);
 if(current.revision!==previous.revision||JSON.stringify(current)!==JSON.stringify(previous))throw new Error('ตะกร้ามีการเปลี่ยนจากอีกหน้าต่าง กรุณาเปิดหน้า POS ใหม่');
 const value=schema.parse({...next,revision:previous.revision+1});
 // Active and held carts commit together in one durable browser write.
 storage.setItem(parkedWorkspaceKey(scope),JSON.stringify(value));
 // Keep the legacy active-cart reader compatible; the workspace is authoritative.
 try{storage.setItem(`pos:cart:v1:${scope}`,JSON.stringify(value.items));}catch{/* The complete workspace was already stored. */}
 return value;
}
export function parkCart(workspace:ParkedWorkspace,id:string,createdAt:string):ParkedWorkspace{
 if(!workspace.items.length)throw new Error('กรุณาเลือกสินค้าก่อนพักบิล');
 if(workspace.bills.length>=50)throw new Error('พักบิลได้สูงสุด 50 บิล กรุณาเรียกคืนบิลเดิมก่อน');
 return {...workspace,items:[],bills:[...workspace.bills,held.parse({id,createdAt,items:workspace.items})]};
}
export function recallCart(workspace:ParkedWorkspace,id:string):ParkedWorkspace{
 if(workspace.items.length)throw new Error('กรุณาคิดเงิน พักบิล หรือล้างตะกร้าปัจจุบันก่อนเรียกคืน');
 const bill=workspace.bills.find(b=>b.id===id);if(!bill)throw new Error('ไม่พบบิลที่พักไว้');
 return {...workspace,items:bill.items,bills:workspace.bills.filter(b=>b.id!==id)};
}

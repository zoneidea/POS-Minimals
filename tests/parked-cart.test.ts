import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readParkedWorkspace,writeParkedWorkspace,parkedWorkspaceKey,parkCart,recallCart,assertNoPendingPayment} from '../apps/web/src/features/pos/parked-cart-storage';
import {pendingSaleKey} from '../apps/web/src/features/pos/pending-sale';
const scope=`${randomUUID()}:${randomUUID()}`;
const item={id:randomUUID(),lineId:randomUUID(),name:'Tea',barcode:'TEA',quantity:2,salePrice:'45.00',stock:0,trackStock:false,optionIds:[randomUUID()],options:[],note:'Less ice',baseUnitPrice:'40.00'};
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},values};}
it('migrates the active cart and atomically parks/recalls cafe details across reloads within the original scope',()=>{
 const s=storage();s.setItem(`pos:cart:v1:${scope}`,JSON.stringify([item]));const initial=readParkedWorkspace(scope,s),id=randomUUID();
 const parked=writeParkedWorkspace(scope,initial,parkCart(initial,id,new Date().toISOString()),s);
 expect(parked.items).toEqual([]);expect(readParkedWorkspace(scope,s).bills[0]?.items).toEqual([item]);expect(readParkedWorkspace('other:user',s).bills).toEqual([]);
 const recalled=writeParkedWorkspace(scope,parked,recallCart(parked,id),s);expect(recalled.items).toEqual([item]);expect(recalled.bills).toEqual([]);expect(()=>recallCart({...recalled,items:[]},id)).toThrow();
});
it('does not overwrite an active cart, stale workspace or corrupted saved data',()=>{
 const s=storage(),initial=readParkedWorkspace(scope,s),id=randomUUID();const active=writeParkedWorkspace(scope,initial,{...initial,items:[item]},s);
 expect(()=>writeParkedWorkspace(scope,initial,{...initial,items:[]},s)).toThrow();
 const held=parkCart(active,id,new Date().toISOString());expect(()=>recallCart({...held,items:[item]},id)).toThrow();
 s.setItem(parkedWorkspaceKey(scope),'broken');expect(()=>readParkedWorkspace(scope,s)).toThrow();
});
it('fails without clearing the original cart when the durable write is denied',()=>{
 const s=storage();s.setItem(`pos:cart:v1:${scope}`,JSON.stringify([item]));const initial=readParkedWorkspace(scope,s);
 const denied={getItem:s.getItem,setItem:()=>{throw new Error('quota');}};
 expect(()=>writeParkedWorkspace(scope,initial,parkCart(initial,randomUUID(),new Date().toISOString()),denied)).toThrow();expect(readParkedWorkspace(scope,s).items).toEqual([item]);
});
it('blocks parking/recall for pending cash or Gateway results including corrupted pending records',()=>{
 for(const key of [pendingSaleKey(scope),`pos:gateway-pending:${scope}`]){const s=storage();s.setItem(key,'unknown-result');expect(()=>assertNoPendingPayment(scope,s)).toThrow();}
 expect(()=>assertNoPendingPayment(scope,storage())).not.toThrow();
});
it('rejects an empty cart or more than 50 held bills',()=>{
 const initial=readParkedWorkspace(scope,storage());expect(()=>parkCart(initial,randomUUID(),new Date().toISOString())).toThrow();
 const full={...initial,items:[item],bills:Array.from({length:50},()=>({id:randomUUID(),createdAt:new Date().toISOString(),items:[item]}))};expect(()=>parkCart(full,randomUUID(),new Date().toISOString())).toThrow();
});

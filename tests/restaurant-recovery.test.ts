import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../apps/web/src/lib/client',()=>({auth:{},request:vi.fn(),RequestError:class extends Error{},authMessage:()=>''}));
import {pendingRestaurantPayments} from '../apps/web/src/features/restaurant/PendingRestaurantPayments';
const scope='owner:shop',id='00000000-0000-4000-8000-000000000001',input={key:id,version:2,receivedAmount:'100.00',totalAmount:'80.00'};
afterEach(()=>vi.unstubAllGlobals());
function storage(entries:[string,string][]){const map=new Map(entries);vi.stubGlobal('localStorage',{get length(){return map.size;},key:(n:number)=>[...map.keys()][n]??null,getItem:(key:string)=>map.get(key)??null});return map;}
it('finds only this cashier/shop payment requests and preserves the immutable retry body',()=>{
 const key=`${scope}:restaurant:cash:${id}`,map=storage([[key,JSON.stringify(input)],[`someone:shop:restaurant:cash:${id}`,JSON.stringify(input)],[`${scope}:restaurant:round:${id}`,JSON.stringify(input)]]);
 expect(pendingRestaurantPayments(scope)).toEqual([{storage:key,billId:id,input}]);expect(map.size).toBe(3);
});
it('keeps unreadable or malformed payment requests visible instead of silently allowing a fresh payment',()=>{
 const key=`${scope}:restaurant:cash:${id}`;for(const value of ['{broken',JSON.stringify({...input,key:'bad'}),'null']){storage([[key,value]]);expect(pendingRestaurantPayments(scope)).toEqual([{storage:key,billId:id,input:null}]);}
});

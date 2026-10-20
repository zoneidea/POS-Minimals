import {it,expect,vi,afterEach} from 'vitest';
import {CustomerDisplaySession} from '../apps/web/src/features/customer-display/session';
import {cartDisplay} from '../apps/web/src/features/customer-display/model';
afterEach(()=>vi.restoreAllMocks());
const frame=(name:string)=>({...cartDisplay([]),items:[{name,quantity:1,unitPrice:'1.00',lineTotal:'1.00'}],total:'1.00',subtotal:'1.00'});
it('coalesces updates behind an in-flight request, preserves sequence, and releases without blocking checkout',async()=>{
 const pending:Array<()=>void>=[],send=vi.fn((_id:string,_sequence:number,_frame:unknown)=>new Promise<void>(resolve=>pending.push(resolve))),release=vi.fn(async()=>{}),error=vi.fn();
 const session=new CustomerDisplaySession({configure:vi.fn(async()=>{}),send,release,error,newId:()=> 'session'});
 session.update(frame('first'));await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(1));
 session.update(frame('second'));session.update(frame('latest'));expect(send).toHaveBeenCalledTimes(1);pending.shift()!();
 await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(2));expect(send.mock.calls[1]![1]).toBe(2);expect(send.mock.calls[1]![2]).toMatchObject({items:[{name:'latest'}]});
 session.close();session.update(frame('closed'));pending.shift()!();await vi.waitFor(()=>expect(release).toHaveBeenCalledWith('session'));expect(send).toHaveBeenCalledTimes(2);
});
it('backs off local Agent failures, reports them separately, and reconnects on the next heartbeat',async()=>{
 let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);const error=vi.fn(),send=vi.fn().mockRejectedValueOnce(new Error('Agent offline')).mockResolvedValue({displayed:true}),configure=vi.fn(async()=>{});
 const session=new CustomerDisplaySession({configure,send,release:vi.fn(async()=>{}),error,newId:()=> 'session'});
 session.update(frame('first'));await vi.waitFor(()=>expect(error).toHaveBeenCalledWith('Agent offline'));
 session.update(frame('second'));session.update(frame('latest'));expect(send).toHaveBeenCalledTimes(1);now+=3001;await session.flush();expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[1]![2]).toMatchObject({items:[{name:'latest'}]});expect(error).toHaveBeenLastCalledWith('');session.close();
});
it('renews a timed-out/tombstoned session identity instead of replaying its old sequence',async()=>{
 let now=1000,index=0;vi.spyOn(Date,'now').mockImplementation(()=>now);const send=vi.fn().mockRejectedValueOnce(Object.assign(new Error('expired'),{code:'DISPLAY_SESSION_CLOSED'})).mockResolvedValue({displayed:true}),error=vi.fn();
 const session=new CustomerDisplaySession({configure:async()=>{},send,release:async()=>{},error,newId:()=> 'id-'+(++index)});
 session.update(frame('first'));await vi.waitFor(()=>expect(error).toHaveBeenCalledWith('expired'));now+=3001;await session.flush();expect(send.mock.calls[1]!.slice(0,2)).toEqual(['id-2',1]);session.close();
});
it('closing during connection setup cannot send the old cart after navigation',async()=>{
 let ready!:()=>void;const send=vi.fn(async()=>{}),release=vi.fn(async()=>{});
 const session=new CustomerDisplaySession({configure:()=>new Promise<void>(resolve=>{ready=resolve;}),send,release,error:vi.fn(),newId:()=> 'session'});
 session.update(frame('old'));session.close();ready();await vi.waitFor(()=>expect(release).toHaveBeenCalledOnce());expect(send).not.toHaveBeenCalled();
});

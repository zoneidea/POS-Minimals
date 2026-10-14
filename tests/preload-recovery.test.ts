import { afterEach,expect,it,vi } from 'vitest';
import { installPreloadRecovery } from '../apps/web/src/lib/preload-recovery';
afterEach(()=>vi.restoreAllMocks());
function setup(storage=new Map<string,string>(),online=true){
 const events=new EventTarget(),reload=vi.fn();
 const target={addEventListener:events.addEventListener.bind(events),navigator:{onLine:online},location:{reload},sessionStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}};
 installPreloadRecovery(target as unknown as Window);
 return {target,reload,fail:()=>{const event=new Event('vite:preloadError',{cancelable:true});events.dispatchEvent(event);return event;}};
}
it('recovers a stale lazy chunk automatically and persists a guard across document reloads',()=>{
 vi.spyOn(Date,'now').mockReturnValue(100_000);const storage=new Map<string,string>();const first=setup(storage);
 expect(first.fail().defaultPrevented).toBe(true);expect(first.reload).toHaveBeenCalledOnce();
 const second=setup(storage);expect(second.fail().defaultPrevented).toBe(false);expect(second.reload).not.toHaveBeenCalled();
});
it('allows a later independent deployment failure to recover',()=>{
 const now=vi.spyOn(Date,'now').mockReturnValue(100_000);const page=setup();page.fail();now.mockReturnValue(160_001);page.fail();expect(page.reload).toHaveBeenCalledTimes(2);
});
it('does not loop when offline or session storage is unavailable',()=>{
 const offline=setup(new Map(),false);expect(offline.fail().defaultPrevented).toBe(false);expect(offline.reload).not.toHaveBeenCalled();
 const blocked=setup();blocked.target.sessionStorage.setItem=()=>{throw new Error('storage denied');};expect(blocked.fail().defaultPrevented).toBe(false);expect(blocked.reload).not.toHaveBeenCalled();
});

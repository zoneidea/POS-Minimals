import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const provider=vi.hoisted(()=>({fire:vi.fn(),close:vi.fn(),update:vi.fn(),getContainer:vi.fn()}));
vi.mock('sweetalert2',()=>({default:provider}));
import {successAlert,warningAlert} from '../apps/web/src/lib/alerts';
let options:any,resolve:(value:unknown)=>void,host:{isConnected:boolean},container:{isConnected:boolean;style:{visibility:string}},observer:{active:boolean;notify:()=>void},append:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.clearAllMocks();host={isConnected:true};container={isConnected:true,style:{visibility:''}};
 append=vi.fn(()=>{container.isConnected=true;});
 vi.stubGlobal('document',{body:{isConnected:true,append},querySelector:(selector:string)=>selector==='dialog[open]'?host:container.isConnected?container:null});
 vi.stubGlobal('MutationObserver',class {active=false;constructor(callback:()=>void){observer={get active(){return instance.active;},notify:()=>{if(instance.active)callback();}};const instance=this;}observe(){this.active=true;}disconnect(){this.active=false;}});
 provider.getContainer.mockReturnValue(container);
 provider.fire.mockImplementation((value:any)=>{options=value;options.didOpen();return new Promise(r=>{resolve=r;});});
 provider.close.mockImplementation(()=>{container.isConnected=false;resolve({isDismissed:true});options.didDestroy();});
});
afterEach(()=>vi.unstubAllGlobals());
it('keeps cleanup alive after the result resolves until the dialog finishes closing',async()=>{
 const pending=successAlert();await vi.waitFor(()=>expect(provider.fire).toHaveBeenCalledOnce());
 resolve!({isDismissed:true});await pending;expect(observer.active).toBe(true);
 host.isConnected=false;container.isConnected=false;observer.notify();
 expect(append).toHaveBeenCalledOnce();expect(provider.close).toHaveBeenCalledOnce();expect(observer.active).toBe(false);
});
it('closes a warning when its dialog disappears and releases the awaiting action',async()=>{
 const pending=warningAlert('test');await vi.waitFor(()=>expect(provider.fire).toHaveBeenCalledOnce());
 host.isConnected=false;container.isConnected=false;observer.notify();await pending;
 expect(provider.close).toHaveBeenCalledOnce();expect(provider.update).toHaveBeenCalledWith({hideClass:{popup:'',backdrop:''}});
});
it('does not reinsert a normally closed popup',async()=>{
 const pending=successAlert();await vi.waitFor(()=>expect(provider.fire).toHaveBeenCalledOnce());
 container.isConnected=false;observer.notify();resolve!({isDismissed:true});await pending;
 expect(append).not.toHaveBeenCalled();expect(provider.close).not.toHaveBeenCalled();expect(observer.active).toBe(false);
});

import {describe,it,expect,vi,afterEach} from 'vitest';
import {confirmAlert,successAlert,warningAlert} from '../apps/web/src/lib/alerts.js';
const fire=vi.hoisted(()=>vi.fn().mockResolvedValue({isConfirmed:true}));
vi.mock('sweetalert2',()=>({default:{fire}}));
afterEach(()=>{vi.unstubAllGlobals();fire.mockClear();});
describe('shared save dialogs',()=>{
 it('shows success for 1500ms without an extra click',async()=>{vi.stubGlobal('document',{querySelector:()=>null,body:{}});await successAlert('Saved');expect(fire).toHaveBeenCalledWith(expect.objectContaining({icon:'success',timer:1500,showConfirmButton:false,allowOutsideClick:false}));});
 it('returns false on cancellation so callers can skip mutation',async()=>{vi.stubGlobal('document',{querySelector:()=>null,body:{}});fire.mockResolvedValueOnce({isConfirmed:false});expect(await confirmAlert('Delete?',true)).toBe(false);expect(fire).toHaveBeenCalledWith(expect.objectContaining({showCancelButton:true,focusCancel:true}));});
 it('renders warning inside an already-open native dialog',async()=>{const dialog={};vi.stubGlobal('document',{querySelector:()=>dialog,body:{}});await warningAlert('Failed');expect(fire).toHaveBeenCalledWith(expect.objectContaining({target:dialog,icon:'warning',text:'Failed'}));});
});

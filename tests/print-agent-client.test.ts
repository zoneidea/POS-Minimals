import {afterEach,expect,it,vi} from 'vitest';
import {agentPrinters} from '../apps/web/src/features/printing/agent-client';
afterEach(()=>vi.unstubAllGlobals());
function printers(rows:unknown[]){vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({printers:rows}))));return agentPrinters('a'.repeat(64));}
it('accepts all five legacy printers without isDefault and preserves their names',async()=>{const rows=Array.from({length:5},(_,i)=>({name:`Printer${i}`,displayName:`เครื่องพิมพ์ ${i}`}));expect(await printers(rows)).toEqual(rows.map(p=>({...p,isDefault:false})));});
it('retains explicitly supplied default flags without guessing another printer',async()=>{expect(await printers([{name:'One',displayName:'One',isDefault:false},{name:'Two',displayName:'Two',isDefault:true}])).toEqual([{name:'One',displayName:'One',isDefault:false},{name:'Two',displayName:'Two',isDefault:true}]);});
it('still rejects malformed flags and missing printer identifiers',async()=>{await expect(printers([{name:'One',displayName:'One',isDefault:'true'}])).rejects.toThrow('อ่านรายการเครื่องพิมพ์จาก Agent ไม่สำเร็จ');await expect(printers([{displayName:'Unknown'}])).rejects.toThrow();});

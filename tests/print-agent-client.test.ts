import {afterEach,expect,it,vi} from 'vitest';
import {agentPrint,agentPrinters} from '../apps/web/src/features/printing/agent-client';
afterEach(()=>vi.unstubAllGlobals());
function printers(rows:unknown[]){vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({printers:rows}))));return agentPrinters('a'.repeat(64));}
it('accepts all five legacy printers without isDefault and preserves their names',async()=>{const rows=Array.from({length:5},(_,i)=>({name:`Printer${i}`,displayName:`เครื่องพิมพ์ ${i}`}));expect(await printers(rows)).toEqual(rows.map(p=>({...p,isDefault:false})));});
it('retains explicitly supplied default flags without guessing another printer',async()=>{expect(await printers([{name:'One',displayName:'One',isDefault:false},{name:'Two',displayName:'Two',isDefault:true}])).toEqual([{name:'One',displayName:'One',isDefault:false},{name:'Two',displayName:'Two',isDefault:true}]);});
it('still rejects malformed flags and missing printer identifiers',async()=>{await expect(printers([{name:'One',displayName:'One',isDefault:'true'}])).rejects.toThrow('อ่านรายการเครื่องพิมพ์จาก Agent ไม่สำเร็จ');await expect(printers([{displayName:'Unknown'}])).rejects.toThrow();});

it('shows safe native failure guidance without exposing arbitrary driver text or retrying',async()=>{
 const fetch=vi.fn(async()=>new Response(JSON.stringify({code:'PRINT_INVALID_SETTINGS',error:'private driver text'}),{status:503}));vi.stubGlobal('fetch',fetch);
 await expect(agentPrint('<p>receipt</p>',{token:'a'.repeat(64),printer:'',width:80})).rejects.toThrow('PRINT_INVALID_SETTINGS');expect(fetch).toHaveBeenCalledTimes(1);
});
it('recognizes old Agent missing-printer errors and safely handles non-JSON failures',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Printer unavailable'}),{status:400})));
 await expect(agentPrinters('a'.repeat(64))).rejects.toThrow('ไม่พบเครื่องพิมพ์ที่เลือก');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('private error',{status:503})));
 await expect(agentPrinters('a'.repeat(64))).rejects.toThrow('กรุณาอัปเดต Agent');
});

it('explains a driver/POS paper mismatch without retrying the print job',async()=>{
 const fetch=vi.fn(async()=>new Response(JSON.stringify({code:'PRINTER_PAPER_MISMATCH'}),{status:503}));vi.stubGlobal('fetch',fetch);
 await expect(agentPrint('<p>receipt</p>',{token:'a'.repeat(64),printer:'',width:80})).rejects.toThrow('ความกว้างกระดาษในไดรเวอร์ Windows ไม่ตรงกับ KidTang');expect(fetch).toHaveBeenCalledOnce();
});

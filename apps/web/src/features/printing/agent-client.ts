import {z} from 'zod';
const base='http://127.0.0.1:17865',key='pos:printer-settings:v1';
const profileSchema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),printer:z.string(),width:z.union([z.literal(58),z.literal(80)])});
export type PrinterProfile=z.infer<typeof profileSchema>;
export function printerProfile():PrinterProfile|null{try{const value=localStorage.getItem(key);return value?profileSchema.parse(JSON.parse(value)):null;}catch{return null;}}
export function savePrinterProfile(profile:PrinterProfile){localStorage.setItem(key,JSON.stringify(profileSchema.parse(profile)));}
export function disconnectPrinter(){localStorage.removeItem(key);}
const printFailures:Record<string,string>={
 PRINTER_METRICS_UNAVAILABLE:'อ่านพื้นที่พิมพ์จากไดรเวอร์ Windows ไม่สำเร็จ กรุณาตรวจไดรเวอร์และการเชื่อมต่อเครื่องพิมพ์',
 PRINTER_PAPER_MISMATCH:'ความกว้างกระดาษในไดรเวอร์ Windows ไม่ตรงกับ KidTang กรุณาตั้งความกว้างให้ตรงกันก่อนพิมพ์',
 PRINTER_UNAVAILABLE:'ไม่พบเครื่องพิมพ์ที่เลือก กรุณาตรวจการติดตั้งเครื่องพิมพ์และเลือกใหม่ในตั้งค่า',
 RECEIPT_LAYOUT_FAILED:'Agent เตรียมขนาดใบเสร็จไม่สำเร็จ กรุณาติดตั้ง Agent 1.0.3 หรือใหม่กว่า',
 PRINT_INVALID_SETTINGS:'เครื่องพิมพ์ปฏิเสธการตั้งค่าการพิมพ์ กรุณาตรวจไดรเวอร์ ขนาดกระดาษ และเครื่องพิมพ์ที่เลือก',
 PRINT_CANCELED:'ระบบเครื่องพิมพ์ยกเลิกงาน กรุณาตรวจคิวพิมพ์ก่อนสั่งซ้ำ',
 PRINT_FAILED:'ส่งเข้าคิวพิมพ์ไม่สำเร็จ กรุณาตรวจเครื่องพิมพ์และคิวพิมพ์ก่อนสั่งซ้ำ',
};
const paperDetailsSchema=z.object({requestedWidthMm:z.union([z.literal(58),z.literal(80)]),paperWidthMm:z.number().min(20).max(5000),paperHeightMm:z.number().min(20).max(5000),printableWidthMm:z.number().min(20).max(5000)});
async function call(path:string,token?:string,body?:unknown){try{
 const response=await fetch(base+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(30000),headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){
  const data=await response.json().catch(()=>null);
  const code=typeof data?.code==='string'&&Object.hasOwn(printFailures,data.code)?data.code:data?.error==='Printer unavailable'?'PRINTER_UNAVAILABLE':undefined;
  const geometry=code==='PRINTER_PAPER_MISMATCH'?paperDetailsSchema.safeParse(data?.details):undefined;
  const sizes=geometry?.success?` · KidTang ${geometry.data.requestedWidthMm} มม. / ไดรเวอร์ ${geometry.data.paperWidthMm} × ${geometry.data.paperHeightMm} มม. / พื้นที่พิมพ์ ${geometry.data.printableWidthMm} มม.`:'';
  const detail=code?printFailures[code]+sizes+` (${code})`:undefined;
  throw new Error(response.status===401?'กรุณาจับคู่ Print Agent ใหม่':response.status===403?'รหัสจับคู่ไม่ถูกต้อง':response.status===429?'มีคำขอมากเกินไป กรุณารอสักครู่':response.status===409?'งานนี้ส่งไปแล้ว กรุณาตรวจเครื่องพิมพ์ก่อนสั่งซ้ำ':detail??'Agent ไม่ได้ระบุสาเหตุการพิมพ์ไม่สำเร็จ กรุณาอัปเดต Agent และตรวจคิวพิมพ์ก่อนสั่งซ้ำ');
 }
 return await response.json();
}catch(error){if(error instanceof TypeError||error instanceof DOMException)throw new Error('เชื่อมต่อ Agent ไม่ได้ กรุณาเปิด Agent และอนุญาตการเชื่อมต่ออุปกรณ์ใน Browser หากส่งงานพิมพ์แล้วให้ตรวจคิวพิมพ์ก่อนสั่งซ้ำ');throw error;}}
const printersSchema=z.object({printers:z.array(z.object({name:z.string(),displayName:z.string(),isDefault:z.boolean().default(false)}))});
export async function pairPrinter(code:string){return z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).parse(await call('/pair',undefined,{code}));}
export async function agentPrinters(token:string){const result=printersSchema.safeParse(await call('/printers',token));if(!result.success)throw new Error('อ่านรายการเครื่องพิมพ์จาก Agent ไม่สำเร็จ กรุณาอัปเดต Agent และตรวจสอบการเชื่อมต่ออีกครั้ง');return result.data.printers;}
export async function agentPrint(html:string,profile:PrinterProfile){const prepared=html.replace('</head>',`<style>:root{--receipt-width:${profile.width}mm}</style></head>`).replace('size:80mm auto',`size:${profile.width}mm auto`).replace('width:72mm',`width:${profile.width-8}mm`);const result=z.object({submitted:z.literal(true)}).parse(await call('/print',profile.token,{jobId:crypto.randomUUID(),html:prepared,width:profile.width,printer:profile.printer}));return result;}
export const agentDownloads=[{label:'Windows 64-bit',file:'POS-Print-Agent-1.0.5-win-x64.exe'},{label:'macOS Intel',file:'POS-Print-Agent-1.0.5-mac-x64.dmg'},{label:'macOS Apple Silicon',file:'POS-Print-Agent-1.0.5-mac-arm64.dmg'}].map(item=>({...item,url:`https://github.com/zoneidea/POS-Minimals/releases/download/print-agent-v1.0.5/${item.file}`}));

import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';
import { ApiError } from '../../infra/errors.js';
import { productInput } from '../products/schema.js';
import { z } from 'zod';
export const importRow=productInput.omit({categoryId:true}).extend({row:z.number().int().min(2),category:z.string().trim().max(120),quantity:z.number().int().min(0).max(2147483647)}).strict();
export type ImportRow=z.infer<typeof importRow>;
export const headers=['barcode','name','category','salePrice','unitCost','quantity'];
// Validate and actually inflate every ZIP member before ExcelJS reads it. Bound both
// compressed and uncompressed size; do not trust ZIP advertised sizes alone.
export function validateArchive(bytes:Buffer){
 const fail=()=>{throw new ApiError(422,'INVALID_WORKBOOK','ไฟล์ XLSX ไม่ถูกต้องหรือมีขนาดเกินกำหนด');};
 if(bytes.length>5*1024*1024||bytes.length<22)fail();
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)fail();
 const n=bytes.readUInt16LE(end+10),offset=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 if(n>200||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0||offset+size!==end)fail();
 let p=offset,total=0;const names=new Set<string>();
 for(let i=0;i<n;i++){
  if(p+46>end||bytes.readUInt32LE(p)!==0x02014b50)fail();
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),compressed=bytes.readUInt32LE(p+20),expanded=bytes.readUInt32LE(p+24),len=bytes.readUInt16LE(p+28),extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),local=bytes.readUInt32LE(p+42);
  if(p+46+len+extra+comment>end||local+30>offset||flags&1||![0,8].includes(method)||expanded>20*1024*1024)fail();
  const name=bytes.subarray(p+46,p+46+len).toString('utf8');if(names.has(name)||name.startsWith('/')||name.split('/').includes('..')||name.endsWith('vbaProject.bin')||name.startsWith('xl/externalLinks/'))fail();names.add(name);
  if(bytes.readUInt32LE(local)!==0x04034b50)fail();
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);if(start+compressed>offset)fail();
  let output:Buffer;try{output=method===0?bytes.subarray(start,start+compressed):inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:20*1024*1024});}catch{fail();}
  if(output!.length!==expanded)fail();total+=expanded;if(total>20*1024*1024)fail();p+=46+len+extra+comment;
 }
 if(p!==end||!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))fail();
}
export async function parseWorkbook(bytes:Buffer){
 validateArchive(bytes);const book=new ExcelJS.Workbook();try{await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);}catch{throw new ApiError(422,'INVALID_WORKBOOK','อ่านไฟล์ XLSX ไม่สำเร็จ');}
 const sheet=book.getWorksheet('Products');if(!sheet||sheet.rowCount>1001||sheet.columnCount>6)throw new ApiError(422,'INVALID_WORKBOOK','ใช้ชีต Products ไม่เกิน 1,000 รายการ และ 6 คอลัมน์ตาม Template');
 if(headers.some((h,i)=>sheet.getRow(1).getCell(i+1).value!==h))throw new ApiError(422,'INVALID_HEADERS','หัวคอลัมน์ไม่ตรงกับ Template');
 const rows:ImportRow[]=[],errors:{row:number;message:string}[]=[];const seen=new Set<string>();
 sheet.eachRow((record,index)=>{if(index===1)return;
  const values=headers.map((_,i)=>record.getCell(i+1).value);if(values.every(v=>v===null||v===''))return;
  // Barcode must be a string: reject numeric cells rather than silently losing zeros.
  const candidate={row:index,barcode:values[0],name:values[1],category:values[2]??'',salePrice:typeof values[3]==='number'?String(values[3]):values[3],unitCost:typeof values[4]==='number'?String(values[4]):values[4],quantity:typeof values[5]==='string'&&/^\d+$/.test(values[5])?Number(values[5]):values[5]};
  const parsed=importRow.safeParse(candidate);if(!parsed.success){errors.push({row:index,message:'ข้อมูลไม่ถูกต้อง: '+[...new Set(parsed.error.issues.map(issue=>issue.path[0]))].join(', ')+' (barcode ต้องเป็น Text และห้ามใช้สูตร)'});return;}
  if(seen.has(parsed.data.barcode))errors.push({row:index,message:'barcode ซ้ำภายในไฟล์'});seen.add(parsed.data.barcode);rows.push(parsed.data);
 });
 if(!rows.length&&!errors.length)throw new ApiError(422,'EMPTY_WORKBOOK','ไฟล์ไม่มีรายการสินค้า');return {rows,errors};
}
export async function templateWorkbook(){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Products');sheet.addRow(headers);sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF5638EF'}};sheet.columns.forEach((c,i)=>{c.width=i===1?32:22;c.numFmt=i===0?'@':i>=3&&i<=4?'0.00':'General';});sheet.views=[{state:'frozen',ySplit:1}];const help=book.addWorksheet('Instructions');help.addRow(['POSJung — นำเข้าสินค้าใหม่เท่านั้น']);help.addRow(['กรอกชีต Products: barcode เป็น Text เพื่อรักษาเลข 0 นำหน้า ห้ามใช้สูตร']);help.addRow(['category ใช้ชื่อหมวดหมู่ที่มีอยู่ หรือเว้นว่าง; ราคา/ต้นทุน >=0 ทศนิยมไม่เกิน 2 ตำแหน่ง']);help.addRow(['quantity เป็นจำนวนเต็ม >=0; สูงสุด 1,000 รายการ; ไม่เกิน 5 MB']);help.addRow(['ไม่รองรับรูปสินค้า และไม่แก้ไขสินค้าที่มี barcode อยู่แล้ว']);help.getColumn(1).width=110;return Buffer.from(await book.xlsx.writeBuffer());}

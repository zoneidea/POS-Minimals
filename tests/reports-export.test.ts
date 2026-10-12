import { expect,it } from 'vitest';
import ExcelJS from 'exceljs';
import { reportWorkbook,excelText } from '../apps/api/src/modules/reports/export';
import { reportRange,reportQuery,type ReportData } from '../apps/api/src/modules/reports/schema';
const query={from:'2026-10-12',to:'2026-10-12',groupBy:'day' as const,page:1};
const report:ReportData={type:'inventory',summary:{productCount:1,quantity:2,valuation:'20.00'},items:[{id:'a0000000-0000-4000-8000-000000000001',barcode:'000123',name:'=1+1',quantity:2,unitCost:'10.00',salePrice:'15.00',valuation:'20.00'}],total:1,page:1,limit:10000};
it('produces a real XLSX with literal formula-safe strings and leading zero barcode',async()=>{const bytes=await reportWorkbook(report,query);const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(bytes).buffer);const sheet=book.getWorksheet('Report')!;expect(sheet.getCell('A9').value).toBe('000123');expect(sheet.getCell('B9').value).toBe("'=1+1");expect(sheet.getCell('D9').value).toBe('10.00');expect(sheet.getCell('A2').value).toBe('เวลา');});
it('escapes dangerous formula prefixes and bounds export',async()=>{for(const text of ['=1+1',' +2','-2','@SUM(A1)','\t=cmd'])expect(excelText(text).startsWith("'")).toBe(true);expect(excelText('Coffee')).toBe('Coffee');await expect(reportWorkbook({...report,total:10001},query)).rejects.toMatchObject({status:422});});
it('converts Bangkok date filters to UTC with exclusive end and validates real dates',()=>{expect(reportRange(query)).toMatchObject({from:'2026-10-11T17:00:00.000Z',to:'2026-10-12T17:00:00.000Z'});expect(reportQuery.safeParse({...query,from:'2026-02-30'}).success).toBe(false);expect(reportRange({...query,to:'2026-10-11'})).toBeNull();expect(reportRange({...query,from:'2025-01-01'})).toBeNull();});

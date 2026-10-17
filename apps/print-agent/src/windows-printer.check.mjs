import {test} from 'node:test';import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {join} from 'node:path';
import {readWindowsPrinter,windowsPageQuery} from './windows-printer.mjs';
const metrics={printerName:'Thermal',paperWidthMm:80.01,paperHeightMm:210.058,printableWidthMm:72,printableHeightMm:208,printableXMm:4,printableYMm:0};
test('passes even hostile/unicode printer names as data, and reads driver metric JSON safely',async()=>{
 const name='ร้าน " $(Write-Output malicious)';
 const result=await readWindowsPrinter(name,async(file,args,options)=>{
  assert.match(file,/powershell.exe$/);assert.equal(args.at(-2),'-EncodedCommand');
  const script=Buffer.from(args.at(-1),'base64').toString('utf16le');assert.equal(script,windowsPageQuery);assert.ok(!script.includes(name));
  assert.equal(Buffer.from(options.env.KIDTANG_PRINTER_NAME_BASE64,'base64').toString('utf8'),name);assert.equal(options.windowsHide,true);assert.equal(options.timeout,15000);
  assert.ok(!script.includes('.Print('));assert.ok(!args.includes('-ExecutionPolicy'));return {stdout:'\uFEFF'+JSON.stringify(metrics)};
 });assert.deepEqual(result,metrics);
});
test('rejects broken metrics and hides exceptions without falling back to an arbitrary paper size',async()=>{
 for(const data of [{...metrics,paperWidthMm:0},{...metrics,printableWidthMm:NaN},{...metrics,printableXMm:100},{...metrics,printerName:''}]){
  await assert.rejects(readWindowsPrinter('',async()=>({stdout:JSON.stringify(data)})),{code:'PRINTER_METRICS_UNAVAILABLE'});
 }
 await assert.rejects(readWindowsPrinter('',async()=>{throw new Error('Private printer data');}),error=>error.code==='PRINTER_METRICS_UNAVAILABLE'&&!error.message.includes('Private'));
});
test('Windows runner parses the exact query with PowerShell and loads the printing API without printing',{skip:process.platform!=='win32'},async()=>{
 const file=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const script=`$errors=$null; $tokens=$null; $source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:KIDTANG_QUERY_TEST)); [void][System.Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors); if($errors.Count -gt 0){exit 1}; Add-Type -AssemblyName System.Drawing; [void](New-Object System.Drawing.Printing.PrinterSettings); Write-Output 'syntax-and-api-ok'`;
 const {stdout}=await promisify(execFile)(file,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,env:{...process.env,KIDTANG_QUERY_TEST:Buffer.from(windowsPageQuery).toString('base64')}});
 assert.match(stdout,/syntax-and-api-ok/);
});
test('Windows reads actual installed driver metrics without submitting a print job',{skip:process.platform!=='win32'},async t=>{
 const file=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const script="[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); Add-Type -AssemblyName System.Drawing; ConvertTo-Json -InputObject @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters) -Compress";
 const {stdout}=await promisify(execFile)(file,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000});
 const printers=JSON.parse(stdout.replace(/^\uFEFF/,'').trim()||'[]');
 if(!printers.length){t.skip('Runner has no installed printer driver');return;}
 const metrics=await readWindowsPrinter(printers.find(name=>name.includes('Print to PDF'))??printers[0]);assert.ok(metrics.paperWidthMm>0);assert.ok(metrics.printableWidthMm>0);
});

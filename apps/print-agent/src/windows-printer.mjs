import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
const run=promisify(execFile);
// Read-only, per-job PageSettings. No Print(), Set-Printer, registry writes,
// execution-policy changes or interpolation of the supplied printer name.
export const windowsPageQuery=String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Drawing
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:KIDTANG_PRINTER_NAME_BASE64))
$printer = New-Object System.Drawing.Printing.PrinterSettings
if ($name.Length -gt 0) { $printer.PrinterName = $name }
if (-not $printer.IsValid) { throw 'Printer unavailable' }
$page = $printer.DefaultPageSettings
$page.Landscape = $false
$area = $page.PrintableArea
$paper = $page.PaperSize
@{
 printerName = $printer.PrinterName
 paperWidthMm = [Math]::Round($paper.Width * 0.254, 3)
 paperHeightMm = [Math]::Round($paper.Height * 0.254, 3)
 printableWidthMm = [Math]::Round($area.Width * 0.254, 3)
 printableHeightMm = [Math]::Round($area.Height * 0.254, 3)
 printableXMm = [Math]::Round($area.X * 0.254, 3)
 printableYMm = [Math]::Round($area.Y * 0.254, 3)
} | ConvertTo-Json -Compress
`;
export async function readWindowsPrinter(printerName,execute=run){
 try {
  const file=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const {stdout}=await execute(file,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(windowsPageQuery,'utf16le').toString('base64')],{
   windowsHide:true,timeout:15000,maxBuffer:16384,encoding:'utf8',
   env:{...process.env,KIDTANG_PRINTER_NAME_BASE64:Buffer.from(printerName,'utf8').toString('base64')},
  });
  const data=JSON.parse(stdout.replace(/^\uFEFF/,''));
  if(typeof data.printerName!=='string'||!data.printerName||data.printerName.length>512)throw new Error('Invalid printer');
  for(const key of ['paperWidthMm','paperHeightMm','printableWidthMm','printableHeightMm','printableXMm','printableYMm']){
   if(!Number.isFinite(data[key])||data[key]<0||data[key]>5000)throw new Error('Invalid dimensions');
  }
  if(data.paperWidthMm<20||data.paperHeightMm<20||data.printableWidthMm<20||data.printableHeightMm<10||data.printableXMm+data.printableWidthMm>data.paperWidthMm+2||data.printableYMm+data.printableHeightMm>data.paperHeightMm+2)throw new Error('Invalid area');
  return data;
 }catch{throw Object.assign(new Error('Cannot read printer page settings'),{code:'PRINTER_METRICS_UNAVAILABLE'});}
}

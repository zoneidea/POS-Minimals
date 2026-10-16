// Exercise the actual Electron renderer without submitting a physical print job.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const directory=mkdtempSync(join(tmpdir(),'kidtang-receipt-smoke-'));
app.setPath('userData',directory);
const timeout=setTimeout(()=>{console.error('Receipt smoke test timed out');app.exit(1);},20000);
app.whenReady().then(async()=>{
 let window, exitCode=0;
 try {
  const {receiptHeight}=await import('./receipt-layout.mjs');
  window=new BrowserWindow({show:false,webPreferences:{javascript:false,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')&&!details.url.startsWith('about:')}));
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<!doctype html><html><body><p id="sentinel">Receipt test</p><script>document.getElementById('sentinel').textContent='UNSAFE';</script></body></html>`));
  // Reproduces the old failure before proving the production replacement works.
  await assert.rejects(window.webContents.executeJavaScript('document.documentElement.scrollHeight'));
  const height=await receiptHeight(window.webContents);
  assert.ok(Number.isInteger(height)&&height>=50000&&height<=2000000);
  assert.equal(await window.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:"document.getElementById('sentinel').textContent"}]),'Receipt test');
  console.log('PASS: receipt measures with page scripts disabled; no physical print submitted');
 } catch(error) {console.error(error);exitCode=1;}
 finally {clearTimeout(timeout);window?.destroy();try{rmSync(directory,{recursive:true,force:true});}catch{}app.exit(exitCode);}
}).catch(error=>{console.error(error);app.exit(1);});
app.on('will-quit',()=>{try{rmSync(directory,{recursive:true,force:true});}catch{}});

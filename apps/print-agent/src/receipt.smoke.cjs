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
  const {receiptWidthCss,printPlan}=await import('./print-plan.mjs');
  window=new BrowserWindow({show:false,webPreferences:{javascript:false,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')&&!details.url.startsWith('about:')}));
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<!doctype html><html><body><p id="sentinel">Receipt test</p><script>document.getElementById('sentinel').textContent='UNSAFE';</script></body></html>`));
  // Reproduces the old failure before proving the production replacement works.
  await assert.rejects(window.webContents.executeJavaScript('document.documentElement.scrollHeight'));
  const height=await receiptHeight(window.webContents);
  assert.ok(Number.isInteger(height)&&height>=10000&&height<=2000000);
  assert.equal(await window.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:"document.getElementById('sentinel').textContent"}]),'Receipt test');
  // A short receipt must not inherit the 600px window height. Long receipts
  // must include their final line, and narrow paper must wrap before measuring.
  for(const width of [58,80]){
   for(const count of [1,80]){
    window.setContentSize(Math.ceil(width*96/25.4),600);
    await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;width:${width}mm;padding:3mm;font:12px sans-serif}p{margin:0;line-height:20px}</style></head><body>${'<p>Thermal receipt item with a long product name</p>'.repeat(count)}<p id="end">CHANGE 8.00</p></body></html>`));
    const plan=printPlan({width,printer:''});await window.webContents.insertCSS(receiptWidthCss(plan.contentWidthMm));
    const bodyWidth=await window.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:'document.body.getBoundingClientRect().width'}]);assert.ok(Math.abs(bodyWidth-plan.contentWidthMm*96/25.4)<1);
    const actual=await receiptHeight(window.webContents);
    const bottom=await window.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:"document.getElementById('end').getBoundingClientRect().bottom"}]);
    assert.ok(actual>bottom*25400/96);
    if(count===1)assert.ok(actual<600*25400/96,'Short receipt must not include blank viewport height');
    if(count===80&&width===80){
     const pdf=await window.webContents.printToPDF({pageSize:{width:80/25.4,height:210/25.4},margins:{top:0,bottom:0,left:0,right:0},printBackground:true});
     const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
     console.log(JSON.stringify({paperHeightMm:210,measuredHeightMm:actual/1000,pages}));
     assert.ok(pages>=2,'Long receipts must paginate on 210mm paper rather than be clipped');
    }
   }
  }
  console.log('PASS: receipt measures with page scripts disabled; no physical print submitted');
 } catch(error) {console.error(error);exitCode=1;}
 finally {clearTimeout(timeout);window?.destroy();try{rmSync(directory,{recursive:true,force:true});}catch{}app.exit(exitCode);}
}).catch(error=>{console.error(error);app.exit(1);});
app.on('will-quit',()=>{try{rmSync(directory,{recursive:true,force:true});}catch{}});

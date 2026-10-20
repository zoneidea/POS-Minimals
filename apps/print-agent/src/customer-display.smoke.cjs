const {app}=require('electron');const assert=require('node:assert/strict');const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');
const directory=mkdtempSync(join(tmpdir(),'posjung-display-smoke-'));app.setPath('userData',directory);
let view,exitCode=0;const timeout=setTimeout(()=>{console.error('Customer display smoke timeout');app.exit(1);},25000);
const wait=async(test)=>{const until=Date.now()+7000;while(Date.now()<until){if(await test())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Customer display render timeout');};
app.whenReady().then(async()=>{
 try{
  const {openCustomerWindow}=await import('./customer-window.mjs');
  view=await openCustomerWindow({bounds:{x:0,y:0,width:1280,height:720}},()=>{},{visible:false});
  const evaluate=code=>view.window.webContents.executeJavaScript(code);
  const preferences=view.window.webContents.getLastWebPreferences();assert.equal(preferences.contextIsolation,true);assert.equal(preferences.nodeIntegration,false);assert.equal(preferences.sandbox,true);assert.equal(await evaluate('typeof require'),'undefined');
  const items=[{name:'<img src=x onerror=alert(1)> ชาเขียว',quantity:2,unitPrice:'20.00',lineTotal:'40.00'}];
  const frame={kind:'payment',items,subtotal:'40.00',discount:'0.00',total:'40.00',received:'50.00',change:'10.00',paymentMethod:'CASH',qr:null};
  view.render({frame,reason:'ACTIVE'});await wait(async()=> (await evaluate('document.getElementById("total").textContent'))==='฿40.00');
  assert.ok((await evaluate('document.getElementById("items").textContent')).includes(items[0].name));assert.equal(await evaluate('document.getElementById("items").querySelectorAll("img").length'),0);assert.equal(await evaluate('document.getElementById("change").textContent'),'฿10.00');assert.equal(await evaluate('document.getElementById("change-label").textContent'),'เงินทอนโดยประมาณ');
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9r0AAAAASUVORK5CYII=';
  const qr={image,amount:'40.00',mode:'GATEWAY',expiresAt:Date.now()+60000};view.render({frame:{...frame,paymentMethod:'PROMPTPAY',received:null,change:null,qr},reason:'ACTIVE'});await wait(async()=> !(await evaluate('document.getElementById("qr-panel").hidden')));
  for(const height of [600,720,1080]){view.window.setContentSize(1280,height);await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const layout=await evaluate('({height:innerHeight,body:document.body.scrollHeight,qr:document.getElementById("qr").getBoundingClientRect().bottom,footer:document.querySelector("footer").getBoundingClientRect().top})');assert.ok(layout.body<=layout.height+1,`display must fit ${height}px: ${JSON.stringify(layout)}`);assert.ok(layout.qr<=layout.footer,`QR must remain completely visible at ${height}px`);}
  view.render({frame:{...frame,paymentMethod:'PROMPTPAY',qr:{...qr,expiresAt:Date.now()-1000}},reason:'ACTIVE'});await wait(async()=> await evaluate('document.getElementById("qr-panel").hidden'));
  view.render({frame:{...frame,kind:'completed',qr:null},reason:'ACTIVE'});await wait(async()=> (await evaluate('document.getElementById("status").textContent'))==='ชำระเงินสำเร็จ');assert.equal(await evaluate('document.getElementById("change-label").textContent'),'เงินทอน');
  view.render({frame:null,reason:'DISCONNECTED'});await wait(async()=> !(await evaluate('document.getElementById("empty").hidden')));assert.equal(await evaluate('document.getElementById("items").textContent'),'');assert.equal(await evaluate('document.getElementById("qr").getAttribute("src")'),null);
  console.log('PASS: sandboxed customer display renders Thai items, totals, cash change and QR expiry; no physical display or print operation submitted');
 }catch(error){console.error(error);exitCode=1;}finally{clearTimeout(timeout);view?.close();try{rmSync(directory,{recursive:true,force:true});}catch{}app.exit(exitCode);}
}).catch(error=>{console.error(error);app.exit(1);});

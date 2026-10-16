import {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage} from 'electron';
import {readFile,writeFile,mkdir,readdir,unlink,appendFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomInt} from 'node:crypto';
import {createBridge} from './bridge.mjs';
import {receiptHeight,nativePrintFailure} from './receipt-layout.mjs';
const base=dirname(fileURLToPath(import.meta.url));let window,tray,server,code=String(randomInt(100000,1000000)),clients={},chain=Promise.resolve();
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{window?.show();window?.focus();});
 app.whenReady().then(async()=>{
  const directory=app.getPath('userData'),state=join(directory,'paired-origins.json');await mkdir(directory,{recursive:true});
  try{clients=JSON.parse(await readFile(state,'utf8'));}catch{clients={};}
  const persist=()=>writeFile(state,JSON.stringify(clients),{mode:0o600});
  const record=(event,jobId,errorCode)=>{void(async()=>{const day=new Date().toISOString().slice(0,10);await appendFile(join(directory,`agent-${day}.jsonl`),JSON.stringify({at:new Date().toISOString(),event,jobId,...(errorCode?{errorCode}:{})})+'\n',{mode:0o600});for(const name of await readdir(directory)){if(/^agent-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)&&Date.parse(name.slice(6,16))+86400000<Date.now()-30*86400000)await unlink(join(directory,name));}})().catch(()=>{});};
  window=new BrowserWindow({width:460,height:330,resizable:false,webPreferences:{preload:join(base,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.on('close',event=>{if(!app.isQuitting){event.preventDefault();window.hide();}});
  const icon=nativeImage.createFromPath(join(base,'icon.png'));tray=new Tray(icon);tray.setToolTip('KidTang Print Agent');tray.setContextMenu(Menu.buildFromTemplate([{label:'เปิด KidTang Print Agent',click:()=>window.show()},{label:'ออกจากโปรแกรม',click:()=>{app.isQuitting=true;app.quit();}}]));tray.on('click',()=>window.show());
  ipcMain.handle('agent-info',()=>({code,version:app.getVersion(),autoStart:app.getLoginItemSettings().openAtLogin}));
  ipcMain.handle('agent-autostart',(_event,enabled)=>{app.setLoginItemSettings({openAtLogin:Boolean(enabled)});return app.getLoginItemSettings().openAtLogin;});
  ipcMain.handle('agent-reset',async()=>{for(const origin of Object.keys(clients))delete clients[origin];code=String(randomInt(100000,1000000));await persist();return {code};});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());await window.loadFile(join(base,'index.html'));
  const listPrinters=async()=>window.webContents.getPrintersAsync();
  const print=job=>{const task=chain.then(async()=>{
   const view=new BrowserWindow({show:false,webPreferences:{partition:'receipt-'+job.jobId,javascript:false,nodeIntegration:false,contextIsolation:true,sandbox:true}});
   view.webContents.setWindowOpenHandler(()=>({action:'deny'}));view.webContents.on('will-navigate',event=>event.preventDefault());
   view.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')&&!details.url.startsWith('about:')}));
   try{await view.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(job.html));const height=await receiptHeight(view.webContents);await new Promise((resolve,reject)=>view.webContents.print({silent:true,deviceName:job.printer,color:false,printBackground:true,margins:{marginType:'none'},pageSize:{width:job.width*1000,height}},(success,reason)=>success?resolve():reject(nativePrintFailure(reason))));}finally{view.destroy();}
  });chain=task.catch(()=>{});return task;};
  server=createBridge({origins:['https://pos-minimals.vercel.app',...(!app.isPackaged?['http://127.0.0.1:5173','http://localhost:5173']:[])],pairCode:()=>code,clients,persist,listPrinters,print,record});
  server.on('error',()=>{window.webContents.send('agent-error','เปิดบริการพิมพ์ไม่ได้ กรุณาปิด Agent ตัวอื่นแล้วเปิดใหม่');});server.listen(17865,'127.0.0.1');
 }).catch(()=>app.quit());app.on('window-all-closed',()=>{});app.on('activate',()=>window?.show());app.on('before-quit',()=>{app.isQuitting=true;server?.close();});
}

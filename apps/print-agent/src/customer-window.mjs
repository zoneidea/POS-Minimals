import {BrowserWindow,screen,ipcMain} from 'electron';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=dirname(fileURLToPath(import.meta.url));
export function customerScreens(){const primary=screen.getPrimaryDisplay().id;return screen.getAllDisplays().map(d=>({...d,primary:d.id===primary}));}
export async function openCustomerWindow(display,onClosed,{visible=true,fx=false}={}){
 const window=new BrowserWindow({...display.bounds,show:false,frame:false,skipTaskbar:true,alwaysOnTop:true,focusable:false,backgroundColor:'#f3f8ff',webPreferences:{preload:join(base,'customer-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,partition:'customer-display'}});
 let state={frame:null,reason:'IDLE'};
 const send=()=>{if(!window.isDestroyed())window.webContents.send('customer-display-state',state);};
 const ready=event=>{if(event.sender===window.webContents)send();};ipcMain.on('customer-display-ready',ready);
 window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
 window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
 window.once('closed',()=>{ipcMain.removeListener('customer-display-ready',ready);onClosed();});
 try{await window.loadFile(join(base,fx?'fx-display.html':'customer-display.html'));if(visible)window.showInactive();}
 catch(error){window.destroy();throw error;}
 return {window,render(value){state=value;send();},move(bounds){if(!window.isDestroyed())window.setBounds(bounds);},close(){if(!window.isDestroyed())window.destroy();}};
}

const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('customerDisplay',{onState(callback){
 const receive=(_event,state)=>callback(state);ipcRenderer.on('customer-display-state',receive);ipcRenderer.send('customer-display-ready');
 return ()=>ipcRenderer.removeListener('customer-display-state',receive);
}});

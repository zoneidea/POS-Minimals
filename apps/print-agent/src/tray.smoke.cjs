const {app,Tray,nativeImage}=require('electron');const assert=require('node:assert/strict');const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');
const directory=mkdtempSync(join(tmpdir(),'posjung-tray-smoke-'));app.setPath('userData',directory);let tray;
app.whenReady().then(async()=>{let result=0;try{
 const {configureAgentIdentity,agentName}=await import('./agent-identity.mjs');
 assert.equal(configureAgentIdentity(app),directory);assert.equal(app.getName(),agentName);assert.equal(app.getPath('userData'),directory);
 const {createTrayIcon}=await import('./tray-icon.mjs');const icon=createTrayIcon(nativeImage);
 assert.equal(icon.isEmpty(),false);
 if(process.platform==='darwin'){assert.deepEqual(icon.getSize(),{width:18,height:18});assert.equal(icon.isTemplateImage(),true);assert.ok(icon.getScaleFactors().includes(2));}
 tray=new Tray(icon);tray.setToolTip(agentName);const bounds=tray.getBounds();
 if(process.platform==='darwin'){assert.ok(bounds.width>0&&bounds.width<=40,JSON.stringify(bounds));assert.ok(bounds.height>0&&bounds.height<=48,JSON.stringify(bounds));}
 console.log(JSON.stringify({name:app.getName(),icon:icon.getSize(),scaleFactors:icon.getScaleFactors(),bounds}));console.log('PASS: tray uses native-size macOS Template/Retina artwork and rename preserves existing userData; no printer/server started');
 }catch(error){console.error(error);result=1;}finally{tray?.destroy();try{rmSync(directory,{recursive:true,force:true});}catch{}app.exit(result);}
}).catch(error=>{console.error(error);app.exit(1);});

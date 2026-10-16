import {test} from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';import {once} from 'node:events';import {createBridge} from './bridge.mjs';
test('origin, pairing, printer selection and duplicate print protection',async()=>{
 let printerRows=[{name:'Thermal',displayName:'Thermal',isDefault:true}];
 let printError;const records=[];const printed=[],clients={};const server=createBridge({origins:['https://pos-minimals.vercel.app'],pairCode:()=> '123456',clients,persist:async()=>{},listPrinters:async()=>{await new Promise(resolve=>setTimeout(resolve,10));return printerRows;},print:async job=>{if(printError)throw printError;printed.push(job);},record:(...entry)=>records.push(entry)});server.listen(0,'127.0.0.1');await once(server,'listening');
 const call=(path,body,token,origin='https://pos-minimals.vercel.app')=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{Host:'127.0.0.1:17865',Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})}},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:data?JSON.parse(data):null}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 try{
 assert.equal((await call('/health',null,null,'https://evil.example')).status,403);assert.equal((await call('/printers')).status,401);assert.equal((await call('/pair',{code:'000000'})).status,403);
 const paired=await call('/pair',{code:'123456'});assert.equal(paired.status,200);const token=paired.data.token;assert.equal((await call('/printers',null,token)).data.printers[0].isDefault,true);
 const job={jobId:'10000000-0000-4000-8000-000000000001',html:'<!doctype html><p>receipt</p>',width:80,printer:''};assert.equal((await call('/print',job,token)).status,200);assert.equal((await call('/print',job,token)).status,409);assert.equal(printed.length,1);
 assert.equal((await call('/print',{...job,jobId:'10000000-0000-4000-8000-000000000002',printer:'Missing'},token)).status,400);assert.equal(printed.length,1);
 const concurrent={...job,jobId:'10000000-0000-4000-8000-000000000003'};const results=await Promise.all([call('/print',concurrent,token),call('/print',concurrent,token)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(printed.length,2);
 // New Electron builds omit isDefault for every printer. Enumerating and OS-default
 // submission must still work; only the OS print API chooses the default device.
 printerRows=Array.from({length:5},(_,i)=>({name:'Printer'+i,displayName:'Printer '+i}));
 const discovered=(await call('/printers',null,token)).data.printers;
 assert.equal(discovered.length,5);assert.ok(discovered.every(p=>p.isDefault===false));
 const current={...job,jobId:'10000000-0000-4000-8000-000000000004'};
 assert.equal((await call('/print',current,token)).status,200);assert.equal(printed.at(-1).printer,'');
 assert.equal((await call('/print',{...current,jobId:'10000000-0000-4000-8000-000000000005',printer:'Printer2'},token)).status,200);assert.equal(printed.at(-1).printer,'Printer2');
 printError=Object.assign(new Error('private driver detail'),{code:'PRINT_INVALID_SETTINGS'});
 const failedJob={...current,jobId:'10000000-0000-4000-8000-000000000007'};
 const failed=await call('/print',failedJob,token);assert.equal(failed.status,503);assert.equal(failed.data.code,'PRINT_INVALID_SETTINGS');assert.equal(failed.data.jobId,failedJob.jobId);assert.ok(!JSON.stringify(failed).includes('private driver detail'));
 assert.deepEqual(records.at(-1),['print_failed',failedJob.jobId,'PRINT_INVALID_SETTINGS']);assert.equal((await call('/print',failedJob,token)).status,409);
 printError=undefined;
 printerRows=[];const before=printed.length;
 const missing=await call('/print',{...current,jobId:'10000000-0000-4000-8000-000000000006'},token);assert.equal(missing.status,400);assert.equal(missing.data.code,'PRINTER_UNAVAILABLE');assert.equal(printed.length,before);
 delete clients['https://pos-minimals.vercel.app'];assert.equal((await call('/printers',null,token)).status,401);
 }finally{server.close();await once(server,'close');}
});

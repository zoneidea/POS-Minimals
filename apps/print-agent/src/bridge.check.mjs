import {test} from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';import {once} from 'node:events';import {createBridge} from './bridge.mjs';
test('origin, pairing, printer selection and duplicate print protection',async()=>{
 const printed=[],clients={};const server=createBridge({origins:['https://pos-minimals.vercel.app'],pairCode:()=> '123456',clients,persist:async()=>{},listPrinters:async()=>[{name:'Thermal',displayName:'Thermal',isDefault:true}],print:async job=>printed.push(job),record:()=>{}});server.listen(0,'127.0.0.1');await once(server,'listening');
 const call=(path,body,token,origin='https://pos-minimals.vercel.app')=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{Host:'127.0.0.1:17865',Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})}},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:data?JSON.parse(data):null}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 try{
 assert.equal((await call('/health',null,null,'https://evil.example')).status,403);assert.equal((await call('/printers')).status,401);assert.equal((await call('/pair',{code:'000000'})).status,403);
 const paired=await call('/pair',{code:'123456'});assert.equal(paired.status,200);const token=paired.data.token;assert.equal((await call('/printers',null,token)).data.printers[0].isDefault,true);
 const job={jobId:'10000000-0000-4000-8000-000000000001',html:'<!doctype html><p>receipt</p>',width:80,printer:''};assert.equal((await call('/print',job,token)).status,200);assert.equal((await call('/print',job,token)).status,409);assert.equal(printed.length,1);
 assert.equal((await call('/print',{...job,jobId:'10000000-0000-4000-8000-000000000002',printer:'Missing'},token)).status,400);assert.equal(printed.length,1);
 delete clients['https://pos-minimals.vercel.app'];assert.equal((await call('/printers',null,token)).status,401);
 }finally{server.close();await once(server,'close');}
});

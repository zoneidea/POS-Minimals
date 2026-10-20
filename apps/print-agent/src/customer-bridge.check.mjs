import {test} from 'node:test';import assert from 'node:assert/strict';import {request} from 'node:http';import {once} from 'node:events';
import {createBridge} from './bridge.mjs';import {allowedOrigins} from './runtime-config.mjs';import {createCustomerDisplay} from './customer-display.mjs';
test('customer display endpoints retain loopback Host, exact Origin and per-origin pairing authentication',async()=>{
 const rendered=[],display=createCustomerDisplay({screens:()=>[{id:1,primary:true,bounds:{x:0,y:0,width:800,height:600}},{id:2,primary:false,bounds:{x:800,y:0,width:1280,height:720}}],openWindow:async()=>({render:state=>rendered.push(state),close(){}})});
 const clients={},server=createBridge({origins:allowedOrigins(true),pairCode:()=> '123456',clients,persist:async()=>{},listPrinters:async()=>[],print:async()=>assert.fail('Display must never submit a print job'),record(){},display});server.listen(0,'127.0.0.1');await once(server,'listening');
 const call=(path,body,token,origin='https://posjung.com',host='127.0.0.1:17865')=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{Host:host,Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,data:data?JSON.parse(data):null}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 try{
  assert.equal((await call('/displays')).status,401);assert.equal((await call('/customer-display/configure',{enabled:true,displayId:'2'})).status,401);
  assert.equal((await call('/health',null,null,'https://evil.test')).status,403);assert.equal((await call('/health',null,null,'https://posjung.com','evil.test:17865')).status,403);
  const old=await call('/pair',{code:'123456'},null,'https://pos-minimals.vercel.app');assert.equal((await call('/displays',null,old.data.token)).status,401);
  const paired=await call('/pair',{code:'123456'}),token=paired.data.token;assert.equal((await call('/displays',null,token)).data.displays.length,2);
  assert.equal((await call('/health')).data.capabilities.customerDisplay,true);
  assert.equal((await call('/customer-display/configure',{enabled:true,displayId:'2'},token)).status,200);
  const sessionId='10000000-0000-4000-8000-000000000001',frame={kind:'cart',items:[],subtotal:'0.00',discount:'0.00',total:'0.00',received:null,change:null,paymentMethod:null,qr:null};
  assert.equal((await call('/customer-display/state',{sessionId,sequence:1,frame},token)).status,200);assert.equal(rendered.at(-1).frame.total,'0.00');
  assert.equal((await call('/customer-display/state',{sessionId,sequence:2,frame:{...frame,script:'evil'}},token)).status,400);
  assert.equal((await call('/customer-display/release',{sessionId},token)).data.released,true);assert.equal(rendered.at(-1).frame,null);
  assert.equal((await call('/customer-display/state',{sessionId,sequence:3,frame},token)).data.code,'DISPLAY_SESSION_CLOSED');
  delete clients['https://posjung.com'];assert.equal((await call('/displays',null,token)).status,401);assert.equal((await call('/displays',null,old.data.token,'https://pos-minimals.vercel.app')).status,200);
 }finally{display.stop();server.close();await once(server,'close');}
});

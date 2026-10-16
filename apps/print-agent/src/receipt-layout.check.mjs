import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptHeight,nativePrintFailure,printFailureCode} from './receipt-layout.mjs';
test('uses a dedicated world and fixed code; clamps thermal height',async()=>{
 for(const [measured,expected] of [[123456.1,123457],[1,50000],[3000000,2000000]]){
  const contents={executeJavaScript(){throw new Error('Page scripts must stay disabled');},async executeJavaScriptInIsolatedWorld(world,scripts){assert.equal(world,1001);assert.deepEqual(scripts,[{code:'Math.ceil(document.documentElement.scrollHeight*25400/96)+8000'}]);return measured;}};
  assert.equal(await receiptHeight(contents),expected);
 }
});
test('layout and driver failures expose only safe diagnostic codes',async()=>{
 for(const value of [NaN,Infinity,0,'123'])await assert.rejects(receiptHeight({executeJavaScriptInIsolatedWorld:async()=>value}),{code:'RECEIPT_LAYOUT_FAILED'});
 await assert.rejects(receiptHeight({executeJavaScriptInIsolatedWorld:async()=>{throw new Error('private receipt content');}}),error=>error.code==='RECEIPT_LAYOUT_FAILED'&&!error.message.includes('private'));
 for(const [reason,expected] of [['Invalid printer settings','PRINT_INVALID_SETTINGS'],['Print job canceled','PRINT_CANCELED'],['private driver info','PRINT_FAILED']]){
  const error=nativePrintFailure(reason);assert.equal(printFailureCode(error),expected);assert.ok(!error.message.includes(reason));
 }
 assert.equal(printFailureCode(new Error('private info')),'PRINT_FAILED');
});

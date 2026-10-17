import {test} from 'node:test';import assert from 'node:assert/strict';
import {printPlan,receiptWidthCss,paperFailureDetails} from './print-plan.mjs';
const job={width:80,printer:''};
const metrics={printerName:'Thermal',paperWidthMm:80.01,paperHeightMm:210.058,printableWidthMm:72.136,printableHeightMm:208,printableXMm:4,printableYMm:0};
test('uses Windows driver paper length and printable width, never receipt height or full roll as content width',()=>{
 const plan=printPlan(job,metrics);assert.equal(plan.contentWidthMm,71.636);
 assert.deepEqual(plan.options.pageSize,{width:80010,height:210058});assert.equal(plan.options.margins.marginType,'printableArea');assert.equal(plan.options.deviceName,'Thermal');
 assert.ok(!JSON.stringify(plan.diagnostics).includes('Thermal'));
 assert.equal(printPlan(job,{...metrics,printableWidthMm:64}).contentWidthMm,63.5);
 assert.equal(printPlan({width:58,printer:''},{...metrics,paperWidthMm:58,printableWidthMm:48}).contentWidthMm,47.5);
});
test('rejects A4/mismatched Windows paper and retains content-sized non-Windows printing',()=>{
 assert.throws(()=>printPlan(job,{...metrics,paperWidthMm:210}),{code:'PRINTER_PAPER_MISMATCH'});
 const mac=printPlan(job);assert.equal(mac.contentWidthMm,72);assert.equal(mac.options.pageSize,undefined);assert.equal(mac.options.deviceName,'');
 assert.match(receiptWidthCss(71.5),/width:71.5mm!important/);assert.throws(()=>receiptWidthCss(NaN));
});

test('fits narrower logical driver pages on an 80mm roll without rejecting safe geometry',()=>{
 for(const width of [72,64,58]){
  const plan=printPlan(job,{...metrics,paperWidthMm:width,printableWidthMm:width-2,printableXMm:1});
  assert.equal(plan.contentWidthMm,width-2.5);
  assert.equal(plan.options.pageSize.width,width*1000);
 }
 assert.equal(printPlan(job,{...metrics,paperWidthMm:82}).options.pageSize.width,82000);
 assert.throws(()=>printPlan({width:58},{...metrics,paperWidthMm:80}),{code:'PRINTER_PAPER_MISMATCH'});
});
test('mismatch exposes bounded numeric geometry only, not driver names or raw errors',()=>{
 let failure;try{printPlan(job,{...metrics,paperWidthMm:210});}catch(error){failure=error;}
 assert.deepEqual(paperFailureDetails(failure),{requestedWidthMm:80,paperWidthMm:210,paperHeightMm:210.058,printableWidthMm:72.136});
 failure.details.printerName='private';assert.ok(!JSON.stringify(paperFailureDetails(failure)).includes('private'));
 failure.details.paperWidthMm=NaN;assert.equal(paperFailureDetails(failure),undefined);
 assert.equal(paperFailureDetails({code:'PRINT_FAILED',details:metrics}),undefined);
});

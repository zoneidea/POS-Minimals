import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {agentName,configureAgentIdentity} from './agent-identity.mjs';
test('renamed Agent retains internal upgrade identity and pins the original pairing directory before changing name',async()=>{
 for(const directory of ['/Users/test/Library/Application Support/@pos/print-agent','C:\\Users\\test\\AppData\\Roaming\\@pos\\print-agent']){
  const calls=[],app={getPath(name){assert.equal(name,'userData');return directory;},setPath(name,value){calls.push([name,value]);},setName(name){calls.push(['name',name]);}};
  assert.equal(configureAgentIdentity(app,path=>calls.push(['directory',path])),directory);assert.deepEqual(calls,[['directory',directory],['userData',directory],['name','posjung-agent']]);
 }
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(pkg.name,'@pos/print-agent');assert.equal(pkg.productName,undefined);assert.equal(pkg.build.appId,'com.zoneidea.pos.printagent');assert.equal(pkg.build.productName,agentName);
});
test('tray assets have 18px/36px transparent PNGs with correct Retina density',async()=>{
 for(const [name,size,pixelsPerMetre] of [['trayTemplate.png',18,2835],['trayTemplate@2x.png',36,5669]]){
  const png=await readFile(new URL(name,import.meta.url));assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);assert.equal(png[25],6);
  let offset=8,density;while(offset<png.length){const len=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8);if(kind==='pHYs')density=png.readUInt32BE(offset+8);offset+=12+len;}assert.ok(Math.abs(density-pixelsPerMetre)<=1);
 }
});

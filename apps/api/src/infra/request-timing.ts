import {AsyncLocalStorage} from 'node:async_hooks';
import type {RequestHandler} from 'express';
type Step='session'|'auth'|'membership'|'redis'|'data';
const timings=new AsyncLocalStorage<Partial<Record<Step,number>>>();
const memo=new AsyncLocalStorage<Map<string,Promise<unknown>>>();
export function requestOnce<T>(key:string,load:()=>Promise<T>):Promise<T>{
 const current=memo.getStore();if(!current)return load();
 const existing=current.get(key);if(existing)return existing as Promise<T>;
 const pending=load();current.set(key,pending);return pending;
}
export async function timeStep<T>(name:Step,load:()=>PromiseLike<T>):Promise<T>{
 const state=timings.getStore(),start=performance.now();
 try{return await load();}finally{if(state)state[name]=(state[name]??0)+performance.now()-start;}
}
export const requestTiming:RequestHandler=(_req,res,next)=>{
 const state:Partial<Record<Step,number>>={};
 res.locals.timingDetails=()=>Object.fromEntries(Object.entries(state).map(([key,value])=>[key,Math.round(value)]));
 const json=res.json.bind(res);
 res.json=body=>{
  const header=Object.entries(state).map(([name,value])=>`${name};dur=${value.toFixed(1)}`).join(', ');
  if(header)res.setHeader('Server-Timing',header);
  return json(body);
 };
 timings.run(state,()=>memo.run(new Map(),next));
};

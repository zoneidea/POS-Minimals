export function tokenSessionId(token:string):string|undefined{
 try{const part=token.split('.')[1]!;const base=part.replace(/-/g,'+').replace(/_/g,'/');const value=JSON.parse(atob(base.padEnd(Math.ceil(base.length/4)*4,'='))).session_id;return typeof value==='string'&&value.length<=100?value:undefined;}catch{return undefined;}
}
export function readDailyExpiry(storage:Pick<Storage,'getItem'>,key:string,sessionId:string):number{
 try{const value=JSON.parse(storage.getItem(key+':day-expiry')??'null');return value?.sessionId===sessionId&&Number.isFinite(value.expires)?value.expires:0;}catch{return 0;}
}
export function writeDailyExpiry(storage:Pick<Storage,'setItem'>,key:string,sessionId:string,expires:number){
 try{storage.setItem(key+':day-expiry',JSON.stringify({sessionId,expires}));}catch{/* In-memory deadline and API enforcement remain active. */}
}
export function clearDailyAuthStorage(storage:Pick<Storage,'removeItem'>,key:string){
 for(const name of [key,key+'-code-verifier',key+':day-expiry'])try{storage.removeItem(name);}catch{/* Do not clear unrelated cart or application data. */}
}

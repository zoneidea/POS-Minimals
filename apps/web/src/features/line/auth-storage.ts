type ReadStore=Pick<Storage,'getItem'>;
export function lineAuthKeys(url:string){
 const project=new URL(url).hostname.split('.')[0];
 return {privateKey:`kidtang:line:auth:v1:${project}`,webKey:`sb-${project}-auth-token`,ssoKey:`kidtang:line:web-sso:v1:${project}`};
}
export function selectedLineAuthKey(keys:ReturnType<typeof lineAuthKeys>,storage?:ReadStore){
 try{if(storage?.getItem(keys.ssoKey)==='web')return keys.webKey;}catch{/* Keep the existing isolated client if storage cannot be read. */}
 return keys.privateKey;
}
export function browserLineStorage():Storage|undefined{try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}}

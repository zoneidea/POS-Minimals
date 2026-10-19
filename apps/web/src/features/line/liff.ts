import {recordLineEvent} from './diagnostics';
export type Liff={init:(config:{liffId:string})=>Promise<void>;isInClient:()=>boolean};
declare global{interface Window{liff?:Liff}}
const source='https://static.line-scdn.net/liff/edge/2/sdk.js';
let pending:Promise<Liff>|undefined;
function loadSdk():Promise<Liff>{
 if(window.liff)return Promise.resolve(window.liff);
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=source;script.async=true;script.dataset.kidtangLineSdk='true';
  const timer=setTimeout(()=>{script.remove();reject(new Error('SDK_TIMEOUT'));},15000);
  script.onload=()=>{clearTimeout(timer);if(window.liff)resolve(window.liff);else{script.remove();reject(new Error('SDK_UNAVAILABLE'));}};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('SDK_UNAVAILABLE'));};document.head.append(script);
 });
}
export function initializeLiff(id:string):Promise<Liff>{
 if(!/^\d+-[A-Za-z0-9]+$/.test(id))return Promise.reject(new Error('LIFF_CONFIG_MISSING'));
 if(!pending)pending=loadSdk().then(async sdk=>{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([sdk.init({liffId:id}),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('INIT_TIMEOUT')),20000);})]);}finally{clearTimeout(timer);}recordLineEvent({event:'LIFF_READY'});return sdk;}).catch(error=>{pending=undefined;recordLineEvent({event:'LIFF_INIT_FAILED'});throw error;});
 return pending;
}

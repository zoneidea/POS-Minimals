export interface AbortablePolling {abort():void;}
/** Own every runner so close/cancel/terminal status cannot leave background polls alive. */
export class GatewayPollingScope {
 active=true;
 private runners=new Set<AbortablePolling>();
 track(runner:AbortablePolling){if(!this.active){runner.abort();return false;}this.runners.add(runner);return true;}
 release(runner:AbortablePolling){this.runners.delete(runner);runner.abort();}
 stop(){this.active=false;for(const runner of this.runners)runner.abort();this.runners.clear();}
}
export const terminalPaymentStatus=(status:string)=>['SUCCESSFUL','FAILED','EXPIRED'].includes(status);
export function qrExpiresAt(value:unknown):number|null {
 return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<8640000000000?value*1000:null;
}
export function qrSecondsLeft(expiresAt:number,now=Date.now()){return Math.max(0,Math.ceil((expiresAt-now)/1000));}
export function qrTimeLabel(seconds:number){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}

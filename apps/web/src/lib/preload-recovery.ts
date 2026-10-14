const RECOVERY_KEY='pos:preload-recovery-at';
const RECOVERY_WINDOW_MS=60_000;
/** Recover stale deployment chunks once per minute, without touching auth or cart storage. */
export function installPreloadRecovery(target:Window){
 target.addEventListener('vite:preloadError',event=>{
  if(!target.navigator.onLine)return;
  try{
   const now=Date.now(),last=Number(target.sessionStorage.getItem(RECOVERY_KEY));
   if(last>0&&now-last<RECOVERY_WINDOW_MS)return;
   target.sessionStorage.setItem(RECOVERY_KEY,String(now));
   event.preventDefault();
   target.location.reload();
  }catch{
   // Without a persistent guard, leave the error boundary in control to avoid a reload loop.
  }
 });
}

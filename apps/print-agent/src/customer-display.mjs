import {displayError,validateDisplayConfig,validateDisplaySession,validateDisplayUpdate} from './customer-display-protocol.mjs';
export const displayLeaseMs=15000;
// Only one POS page owns the physical customer screen at a time. Never persist frames.
export function createCustomerDisplay({screens,openWindow,record=()=>{},now=Date.now}){
 let selected=null,view=null,owner=null,frame=null,lastFrame='',generation=0,chain=Promise.resolve();
 const released=new Map();
 const emit=reason=>view?.render({frame,reason});
 const reset=reason=>{owner=null;frame=null;lastFrame='';emit(reason);};
 const selectable=()=>{const rows=screens(),primary=rows.find(d=>d.primary);if(!primary)return [];return rows.filter(d=>d.primary||!(d.bounds.x<primary.bounds.x+primary.bounds.width&&d.bounds.x+d.bounds.width>primary.bounds.x&&d.bounds.y<primary.bounds.y+primary.bounds.height&&d.bounds.y+d.bounds.height>primary.bounds.y));};
 const list=()=>selectable().map(d=>({id:String(d.id),label:d.label||`จอ ${d.id}`,width:d.bounds.width,height:d.bounds.height,primary:d.primary}));
 const busy=origin=>owner&&owner.until>now()&&selected?.origin!==origin;
 const close=reason=>{generation++;view?.close();view=null;selected=null;reset(reason);record('customer_display_closed');};
 const tick=()=>{
  for(const [key,until] of released)if(until<=now())released.delete(key);
  if(owner&&owner.until<=now()){released.set(owner.origin+':'+owner.id,now()+60000);reset('DISCONNECTED');record('customer_display_lease_expired');}
  if(frame?.qr?.expiresAt!==null&&frame?.qr&&frame.qr.expiresAt<=now()){frame={...frame,qr:null};emit('QR_EXPIRED');record('customer_display_qr_expired');}
 };
 const timer=setInterval(tick,500);timer.unref?.();
 const api={
  info(origin){tick();return {displays:list(),enabled:selected?.origin===origin,displayId:selected?.origin===origin?selected.id:null};},
  configure(origin,input){const operation=chain.then(async()=>{
   tick();const config=validateDisplayConfig(input);
   if(busy(origin))throw displayError('DISPLAY_BUSY');
   if(!config.enabled){close('IDLE');return {enabled:false,displayId:null};}
   const target=selectable().find(d=>String(d.id)===config.displayId&&!d.primary);
   if(!target)throw displayError('DISPLAY_UNAVAILABLE');
   if(owner&&selected?.id!==config.displayId)throw displayError('DISPLAY_BUSY');
   if(view&&selected?.origin===origin&&selected.id===config.displayId)return {enabled:true,displayId:selected.id};
   close('IDLE');selected={origin,id:config.displayId};const revision=generation;
   try{const next=await openWindow(target,()=>{if(revision===generation)close('IDLE');});
    if(revision!==generation){next.close();throw displayError('DISPLAY_UNAVAILABLE');}
    view=next;emit('IDLE');record('customer_display_opened');return {enabled:true,displayId:selected.id};
   }catch{if(revision===generation)close('IDLE');throw displayError('DISPLAY_UNAVAILABLE');}
  });chain=operation.catch(()=>{});return operation;},
  update(origin,input){
   tick();const update=validateDisplayUpdate(input);
   if(!view||selected?.origin!==origin)throw displayError('DISPLAY_DISABLED');
   if(released.has(origin+':'+update.sessionId))throw displayError('DISPLAY_SESSION_CLOSED');
   if(owner&&owner.id!==update.sessionId)throw displayError('DISPLAY_BUSY');
   if(owner&&update.sequence<=owner.sequence)throw displayError('DISPLAY_STALE_UPDATE');
   owner={id:update.sessionId,origin,sequence:update.sequence,until:now()+displayLeaseMs};frame=update.frame;
   let reason='ACTIVE';if(frame.qr?.expiresAt!==null&&frame.qr&&frame.qr.expiresAt<=now()){frame={...frame,qr:null};reason='QR_EXPIRED';}
   const current=JSON.stringify(frame);if(current!==lastFrame){lastFrame=current;emit(reason);record('customer_display_updated');}
   return {displayed:true};
  },
  release(origin,input){
   const id=validateDisplaySession(input);if(released.size>=2000)throw displayError('DISPLAY_BUSY');
   released.set(origin+':'+id,now()+60000);const owned=selected?.origin===origin&&owner?.id===id;
   if(owned){reset('IDLE');record('customer_display_released');}return {released:Boolean(owned)};
  },
  monitorsChanged(){if(!selected)return;const target=selectable().find(d=>String(d.id)===selected.id&&!d.primary);if(!target)close('DISCONNECTED');else view?.move?.(target.bounds);},
  reset(){close('IDLE');released.clear();},
  stop(){clearInterval(timer);close('IDLE');released.clear();},
 };
 return api;
}

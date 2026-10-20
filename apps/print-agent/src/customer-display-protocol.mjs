const money=/^(0|[1-9]\d{0,29})\.\d{2}$/;
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
export function displayError(code){return Object.assign(new Error(code),{code});}
export function validateDisplayConfig(value){
 if(!keys(value,['enabled','displayId'])||typeof value.enabled!=='boolean'||typeof value.displayId!=='string'||value.displayId.length>80)throw displayError('DISPLAY_INVALID_REQUEST');
 return {enabled:value.enabled,displayId:value.displayId};
}
export function validateDisplaySession(value){
 if(!keys(value,['sessionId'])||!uuid.test(value.sessionId??''))throw displayError('DISPLAY_INVALID_REQUEST');
 return value.sessionId;
}
export function validateDisplayUpdate(value){
 if(!keys(value,['sessionId','sequence','frame'])||!uuid.test(value.sessionId??'')||!Number.isSafeInteger(value.sequence)||value.sequence<1)throw displayError('DISPLAY_INVALID_REQUEST');
 const frame=value.frame;
 if(!keys(frame,['kind','items','subtotal','discount','total','received','change','paymentMethod','qr'])||!['cart','payment','completed'].includes(frame.kind)||!Array.isArray(frame.items)||frame.items.length>200)throw displayError('DISPLAY_INVALID_REQUEST');
 for(const item of frame.items){
  if(!keys(item,['name','quantity','unitPrice','lineTotal'])||typeof item.name!=='string'||!item.name.trim()||item.name.length>200||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>2147483647||typeof item.unitPrice!=='string'||typeof item.lineTotal!=='string'||!money.test(item.unitPrice)||!money.test(item.lineTotal))throw displayError('DISPLAY_INVALID_REQUEST');
 }
 for(const key of ['subtotal','discount'])if(typeof frame[key]!=='string'||!money.test(frame[key]))throw displayError('DISPLAY_INVALID_REQUEST');
 for(const key of ['total','received','change'])if(frame[key]!==null&&(typeof frame[key]!=='string'||!money.test(frame[key])))throw displayError('DISPLAY_INVALID_REQUEST');
 if(![null,'CASH','PROMPTPAY'].includes(frame.paymentMethod))throw displayError('DISPLAY_INVALID_REQUEST');
 if(frame.qr!==null){
  const qr=frame.qr;
  if(!keys(qr,['image','expiresAt','amount','mode'])||typeof qr.image!=='string'||qr.image.length>200000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(qr.image)||!['UPLOAD','GATEWAY'].includes(qr.mode)||typeof qr.amount!=='string'||!money.test(qr.amount)||qr.amount!==frame.total||frame.paymentMethod!=='PROMPTPAY'||frame.kind!=='payment'||(qr.mode==='GATEWAY'?(!Number.isSafeInteger(qr.expiresAt)||qr.expiresAt<=0):qr.expiresAt!==null))throw displayError('DISPLAY_INVALID_REQUEST');
 }
 if(frame.kind==='completed'&&(frame.total===null||frame.received===null||frame.change===null||frame.qr!==null))throw displayError('DISPLAY_INVALID_REQUEST');
 return structuredClone(value);
}

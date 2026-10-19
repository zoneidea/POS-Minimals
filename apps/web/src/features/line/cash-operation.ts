import {linePendingKey} from './storage';
import type {LinePending,LineSale,LineSaleInput} from './schema';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Api={commit:(input:LineSaleInput,key:string)=>Promise<LineSale>;recover:(key:string)=>Promise<LineSale>};
// Persist before sending, and recover with exactly the same key and immutable payload.
export async function submitLineOperation(scope:string,operation:LinePending,api:Api,storage:Store){storage.setItem(linePendingKey(scope),JSON.stringify(operation));return api.commit(operation.input,operation.key);}
export async function recoverLineOperation(operation:LinePending,api:Api){try{return await api.recover(operation.key);}catch(error){if((error as {status?:number})?.status===404)return api.commit(operation.input,operation.key);throw error;}}
export function knownRejectedLineOperation(error:unknown){const e=error as {status?:number;code?:string};return Boolean((e.status===400&&e.code==='VALIDATION_ERROR')||(e.status===409&&['CART_STALE','INSUFFICIENT_STOCK','INSUFFICIENT_PAYMENT','PRODUCT_UNAVAILABLE','COUPON_UNAVAILABLE','COUPON_EXHAUSTED','COUPON_EXPIRED','COUPON_NOT_STARTED'].includes(e.code??'')));}

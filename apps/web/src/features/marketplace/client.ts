import {couponRequest} from '../coupons/client';
import {entitlementsSchema} from '../coupons/schema';
import {announceModuleChange} from './module-events';
export async function setModuleEnabled(code:'coupons',enabled:boolean){const value=entitlementsSchema.parse(await couponRequest(`/marketplace/modules/${code}`,{enabled},'PATCH'));announceModuleChange();return value;}

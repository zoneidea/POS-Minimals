export type ModuleEntitlements={coupons:boolean;purchased?:{coupons:boolean}};
export function moduleAccessState(value:ModuleEntitlements){return {coupons:value.coupons,purchasedCoupons:value.purchased?.coupons??value.coupons,loading:false,error:''};}

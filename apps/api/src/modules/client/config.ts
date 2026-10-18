import {z} from 'zod';
export const clientConfigQuery=z.object({profile:z.literal('integration').optional()}).strict();
// Public protocol metadata only. These values never grant membership or module access.
export function getClientConfiguration(profile?:'integration'){
 const version={apiVersion:'v1',minimumWebVersion:'1.0.0',receiptSchemaVersion:1} as const;
 if(!profile)return version;
 return {...version,integration:{
  contractRevision:1,basePath:'/api/v1',authProvider:'SUPABASE',
  tokenHeader:'Authorization',moneyEncoding:'decimal-string',businessTimeZone:'Asia/Bangkok',
  timestamps:'iso-8601',pagination:'data',
  identityPath:'/api/v1/auth/me',sessionPolicyPath:'/api/v1/auth/session-policy',logoutPath:'/api/v1/auth/logout',
  checkoutRecoveryPath:'/api/v1/sales/by-idempotency-key/{key}',
  offlineCheckout:false,nativePaymentGatewayReady:false,modulePurchaseMode:'DEMO',
 }} as const;
}

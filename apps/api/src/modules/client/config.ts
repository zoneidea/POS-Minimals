import {z} from 'zod';
export const clientConfigQuery=z.object({profile:z.enum(['integration','react-native']).optional()}).strict();
// Public protocol metadata only. These values never grant membership or module access.
export function getClientConfiguration(profile?:'integration'|'react-native'){
 const version={apiVersion:'v1',minimumWebVersion:'1.0.0',receiptSchemaVersion:1} as const;
 if(!profile)return version;
 return {...version,integration:{
  contractRevision:1,basePath:'/api/v1',authProvider:'SUPABASE',
  tokenHeader:'Authorization',moneyEncoding:'decimal-string',businessTimeZone:'Asia/Bangkok',
  timestamps:'iso-8601',pagination:'data',
  identityPath:'/api/v1/auth/me',sessionPolicyPath:'/api/v1/auth/session-policy',logoutPath:'/api/v1/auth/logout',
  checkoutRecoveryPath:'/api/v1/sales/by-idempotency-key/{key}',
  offlineCheckout:false,nativePaymentGatewayReady:false,modulePurchaseMode:'DEMO',
 },...(profile==='react-native'?{reactNative:{
  framework:'react-native',applicationReleased:false,
  tokenStorage:'OS_SECURE_STORAGE',sessionExpiry:'ASIA_BANGKOK_MIDNIGHT',
  storeModes:['RETAIL','CAFE','RESTAURANT'],parkedBillsSync:false,
  printing:'PLATFORM_ADAPTER_REQUIRED',customerDisplay:'PLATFORM_ADAPTER_REQUIRED',
 }}:{})} as const;
}

import {NodeReadCache} from './infra/node-read-cache.js';
import {createBankUnlink} from './modules/payments/reservepay-unlink.js';
import {bankLedger,createBankSync} from './modules/payments/reservepay-bank.js';
import { contactLedger,createContactSync } from './modules/orgs/reservepay.js';
import { createPaymentSettingsService } from './modules/payments/service.js';
import { createActivityService } from './modules/audits/service.js';
import { createBillService } from './modules/sales/bill-service.js';
import { createImportService } from './modules/imports/service.js';
import { createReportsService } from './modules/reports/service.js';
import { createManagementService } from './modules/management/service.js';
import { createSaleManagementService } from './modules/sales/void-service.js';
import { createImageUploadService } from './modules/products/image-service.js';
import { createCheckoutService } from './modules/sales/checkout-service.js';
import { createQuoteService } from './modules/sales/quote.js';
import { createCatalogService } from './modules/catalog/service.js';
import { createStockService } from './modules/stock/service.js';
import { createProductService } from './modules/products/service.js';
import { createCategoryService } from './modules/categories/service.js';
import { createBootstrapService } from './modules/orgs/service.js';
import { createApp } from './app.js';
import { createIdentityResolver } from './modules/auth/resolver.js';
import { createRequestLogger } from './infra/logging.js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
const app = createApp({nodeCache:new NodeReadCache(),paymentSettings:createPaymentSettingsService(url,key,process.env.SALE_SNAPSHOT_KEY??'',createBankSync(process.env.RESERVEPAY_API_KEY,process.env.SALE_SNAPSHOT_KEY??'',process.env.SUPABASE_SECRET_KEY?bankLedger(url,process.env.SUPABASE_SECRET_KEY):undefined),createBankUnlink(process.env.RESERVEPAY_API_KEY,process.env.SALE_SNAPSHOT_KEY??'',process.env.SUPABASE_SECRET_KEY?bankLedger(url,process.env.SUPABASE_SECRET_KEY):undefined)), activities:createActivityService(url,key), bills: createBillService(url,key,process.env.SALE_SNAPSHOT_KEY??''), imports: createImportService(url,key), reports: createReportsService(url,key), management: createManagementService(url,key,process.env.SALE_SNAPSHOT_KEY??'',process.env.SUPABASE_SECRET_KEY,process.env.APP_PUBLIC_URL), saleManagement: createSaleManagementService(url,key,process.env.SALE_SNAPSHOT_KEY??''), uploadProductImage: createImageUploadService(url,key), checkout: createCheckoutService(url,key,process.env.SALE_SNAPSHOT_KEY??''), quote: createQuoteService(url,key), catalog: createCatalogService(url,key), stock: createStockService(url,key), products: createProductService(url,key), categories: createCategoryService(url,key), resolveIdentity: createIdentityResolver(url, key), bootstrapOrganization: createBootstrapService(url, key,process.env.SALE_SNAPSHOT_KEY??'',createContactSync(process.env.RESERVEPAY_API_KEY,process.env.SUPABASE_SECRET_KEY?contactLedger(url,process.env.SUPABASE_SECRET_KEY):undefined)),
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim()).filter(Boolean),
  log: createRequestLogger(undefined,{url,secret:process.env.SUPABASE_SECRET_KEY}),
});
export default app;
if (!process.env.VERCEL) app.listen(Number(process.env.PORT ?? 8080), '127.0.0.1', () => console.log('API listening on http://127.0.0.1:8080'));

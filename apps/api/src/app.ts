import {gatewayReportRoutes,type GatewayReports} from './modules/reports/gateway.js';
import type {GatewayConfirmation} from './modules/payments/gateway-confirm.js';
import {gatewayRoutes,type GatewayService} from './modules/payments/gateway.js';
import {cachedRead,coalesceIdentity,type NodeReadCache} from './infra/node-read-cache.js';
import { paymentSettingsRoutes } from './modules/payments/routes.js';
import type { PaymentSettingsService } from './modules/payments/service.js';
import { activityRoutes } from './modules/audits/routes.js';
import type { ActivityService } from './modules/audits/service.js';
import { billRoutes } from './modules/sales/bill-routes.js';
import type { BillService } from './modules/sales/bill-service.js';
import { importRoutes } from './modules/imports/routes.js';
import type { ImportService } from './modules/imports/service.js';
import { reportsRoutes } from './modules/reports/routes.js';
import type { ReportsService } from './modules/reports/service.js';
import { managementRoutes } from './modules/management/routes.js';
import type { ManagementService } from './modules/management/service.js';
import { saleManagementRoutes } from './modules/sales/void-routes.js';
import type { SaleManagementService } from './modules/sales/void-schema.js';
import { productImageRoutes } from './modules/products/image-routes.js';
import type { UploadProductImage } from './modules/products/image-service.js';
import { checkoutRoutes } from './modules/sales/checkout-routes.js';
import type { CheckoutService } from './modules/sales/checkout-schema.js';
import { quoteRoutes,type QuoteService } from './modules/sales/quote.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import type { CatalogService } from './modules/catalog/schema.js';
import { stockRoutes } from './modules/stock/routes.js';
import type { StockService } from './modules/stock/schema.js';
import { productRoutes } from './modules/products/routes.js';
import type { ProductService } from './modules/products/schema.js';
import express from 'express';
import { categoryRoutes } from './modules/categories/routes.js';
import type { CategoryService } from './modules/categories/schema.js';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from './infra/errors.js';
import type { LogRequest } from './infra/logging.js';
import { bearerToken } from './middleware/bearer.js';
import { organizationRoutes } from './modules/orgs/routes.js';
import type { BootstrapOrganization } from './modules/orgs/schema.js';
import type { ResolveIdentity } from './modules/auth/types.js';
export interface AppOptions { gateway?:GatewayService;gatewayConfirm?:GatewayConfirmation;gatewayReports?:GatewayReports; checkSessionDay?:(token:string)=>Promise<number>; nodeCache?:NodeReadCache; paymentSettings?:PaymentSettingsService; activities?:ActivityService; bills?: BillService; imports?: ImportService; reports?: ReportsService; management?: ManagementService; saleManagement?: SaleManagementService; uploadProductImage?: UploadProductImage; checkout?: CheckoutService; quote?: QuoteService; catalog?: CatalogService; stock?: StockService; products?: ProductService; categories?: CategoryService; resolveIdentity: ResolveIdentity; bootstrapOrganization?: BootstrapOrganization; allowedOrigins: string[]; log: LogRequest }
export function createApp(options: AppOptions) {
  const app = express();
  const resolveIdentity=coalesceIdentity(options.nodeCache,options.resolveIdentity);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const supplied = z.uuid().safeParse(req.header('X-Request-ID'));
    res.locals.requestId = supplied.success ? supplied.data : randomUUID();
    res.setHeader('X-Request-ID', res.locals.requestId);
    res.setHeader('Cache-Control', 'no-store');
    const start = performance.now();
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.path.endsWith('/quote')&&!req.path.endsWith('/preview'))res.on('finish',()=>options.nodeCache?.clear());
    res.on('finish', () => options.log({ requestId: res.locals.requestId, method: req.method,
      path: typeof req.route?.path==='string'?`${req.baseUrl}${req.route.path}`:'unmatched', status: res.statusCode, durationMs: Math.round(performance.now() - start) }));
    next();
  });
  app.use(helmet());
  app.use(cors({ origin(origin, cb) {
    if (!origin || options.allowedOrigins.includes(origin)) cb(null, true);
    else cb(new ApiError(403, 'FORBIDDEN', 'Origin ไม่ได้รับอนุญาต'));
  }, allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID', 'X-Client-Platform', 'X-Client-Version', 'Idempotency-Key'] }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/v1',async(req,res,next)=>{if(!options.checkSessionDay||['/health','/client/config'].includes(req.path)){next();return;}res.locals.sessionExpiresAt=await options.checkSessionDay(bearerToken(req.header('Authorization')));next();});
  app.get('/api/v1/auth/session-policy',(_req,res)=>{if(!res.locals.sessionExpiresAt)throw new ApiError(503,'SERVICE_UNAVAILABLE','ไม่สามารถตรวจสอบอายุการเข้าสู่ระบบได้');res.json({success:true,data:{expiresAt:new Date(res.locals.sessionExpiresAt).toISOString()}});});
  app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
  app.get('/api/v1/client/config', (_req, res) => res.json({ success: true,
    data: { apiVersion: 'v1', minimumWebVersion: '1.0.0', receiptSchemaVersion: 1 } }));
  app.get('/api/v1/auth/me', async (req, res) => {
    const context = await resolveIdentity(bearerToken(req.header('Authorization')));
    res.json({ success: true, data: await cachedRead(options.nodeCache,bearerToken(req.header('Authorization')),context,'identity-profile',null,5000,async()=>context) });
  });
  if(options.gateway)app.use('/api/v1',gatewayRoutes(resolveIdentity,options.gateway,options.gatewayConfirm));
  if(options.paymentSettings)app.use('/api/v1',paymentSettingsRoutes(resolveIdentity,options.paymentSettings,options.nodeCache));
  if(options.activities)app.use('/api/v1/audits',activityRoutes(resolveIdentity,options.activities));
  if (options.bootstrapOrganization) app.use('/api/v1/orgs', organizationRoutes(options.bootstrapOrganization));
  if(options.checkout) app.use('/api/v1/sales',checkoutRoutes(resolveIdentity,options.checkout));
  if(options.quote) app.use('/api/v1/sales',quoteRoutes(resolveIdentity,options.quote));
  if(options.bills) app.use('/api/v1/sales',billRoutes(resolveIdentity,options.bills));
  if(options.saleManagement) app.use('/api/v1/sales',saleManagementRoutes(resolveIdentity,options.saleManagement));
  if(options.catalog) app.use('/api/v1/products',catalogRoutes(resolveIdentity,options.catalog,options.nodeCache));
  if(options.imports) app.use('/api/v1/inventory/import',importRoutes(resolveIdentity,options.imports));
  if(options.stock) app.use('/api/v1/inventory',stockRoutes(resolveIdentity,options.stock));
  if(options.uploadProductImage) app.use('/api/v1/inventory/products',productImageRoutes(resolveIdentity,options.uploadProductImage));
  if(options.products) app.use('/api/v1/inventory/products',productRoutes(resolveIdentity,options.products,options.nodeCache));
  if(options.categories) app.use('/api/v1/categories',categoryRoutes(resolveIdentity,options.categories,options.nodeCache));
  if(options.gatewayReports)app.use('/api/v1',gatewayReportRoutes(resolveIdentity,options.gatewayReports));
  if(options.reports) app.use('/api/v1',reportsRoutes(resolveIdentity,options.reports));
  if(options.management) app.use('/api/v1',managementRoutes(resolveIdentity,options.management,options.nodeCache));
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'ไม่พบ API ที่ร้องขอ')));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const parseError = error as { type?: string };
    const safe = error instanceof ApiError ? error : parseError?.type === 'entity.parse.failed'
      ? new ApiError(400, 'VALIDATION_ERROR', 'รูปแบบ JSON ไม่ถูกต้อง')
      : parseError?.type === 'entity.too.large' ? new ApiError(413, 'VALIDATION_ERROR', 'ข้อมูลมีขนาดเกินกำหนด')
      : new ApiError(500, 'INTERNAL_ERROR', 'เกิดข้อผิดพลาดภายในระบบ');
    res.status(safe.status).json({ success: false, error: { code: safe.code, message: safe.message }, requestId: res.locals.requestId });
  });
  return app;
}

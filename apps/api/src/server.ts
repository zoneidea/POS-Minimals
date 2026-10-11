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
const app = createApp({ catalog: createCatalogService(url,key), stock: createStockService(url,key), products: createProductService(url,key), categories: createCategoryService(url,key), resolveIdentity: createIdentityResolver(url, key), bootstrapOrganization: createBootstrapService(url, key),
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim()).filter(Boolean),
  log: createRequestLogger(),
});
export default app;
if (!process.env.VERCEL) app.listen(Number(process.env.PORT ?? 8080), '127.0.0.1', () => console.log('API listening on http://127.0.0.1:8080'));

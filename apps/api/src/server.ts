import { createBootstrapService } from './modules/orgs/service.js';
import { createApp } from './app.js';
import { createIdentityResolver } from './modules/auth/resolver.js';
import { createRequestLogger } from './infra/logging.js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
const app = createApp({ resolveIdentity: createIdentityResolver(url, key), bootstrapOrganization: createBootstrapService(url, key),
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  log: createRequestLogger(),
});
export default app;
if (!process.env.VERCEL) app.listen(Number(process.env.PORT ?? 8080), '127.0.0.1', () => console.log('API listening on http://127.0.0.1:8080'));

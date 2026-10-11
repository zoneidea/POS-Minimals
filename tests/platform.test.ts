import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { createApp } from '../apps/api/src/app.js';
import { ApiError } from '../apps/api/src/infra/errors.js';
import { permissionsFor } from '../apps/api/src/modules/auth/permissions.js';
import type { UserContext, Role } from '../apps/api/src/modules/auth/types.js';
import { errorResponseSchema, userContextSchema } from '../packages/contracts/src/index.js';
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const context = (orgId: string, role: Role = 'OWNER'): UserContext => ({
  userId: a, orgId, orgName: 'ร้านทดสอบ', username: 'ผู้ใช้', role, permissions: permissionsFor(role),
});
function setup() {
  const resolveIdentity = vi.fn(async (token: string) => {
    if (token === 'expired') throw new ApiError(401, 'UNAUTHENTICATED', 'Expired');
    if (token === 'suspended') throw new ApiError(403, 'FORBIDDEN', 'Suspended');
    if (token === 'failure') throw new Error('private database password');
    return context(token === 'org-b' ? b : a);
  });
  const log = vi.fn();
  return { app: createApp({ resolveIdentity, allowedOrigins: ['http://localhost:5173'], log }), resolveIdentity, log };
}
describe('public system routes', () => {
  it('health is liveness only and never queries identity', async () => {
    const { app, resolveIdentity } = setup();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('client config contains version information only', async () => {
    const res = await request(setup().app).get('/api/v1/client/config');
    expect(res.body.data).toEqual({ apiVersion: 'v1', minimumWebVersion: '1.0.0', receiptSchemaVersion: 1 });
  });
});
describe('auth boundary', () => {
  it.each([undefined, 'Basic abc', 'Bearer', 'Bearer abc extra'])('rejects missing/malformed bearer %s', async (auth) => {
    const { app, resolveIdentity } = setup();
    const req = request(app).get('/api/v1/auth/me');
    if (auth) req.set('Authorization', auth);
    const res = await req;
    expect(res.status).toBe(401);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(resolveIdentity).not.toHaveBeenCalled();
  });
  it('does not trust org query/body/header or platform as identity', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/v1/auth/me?orgId=' + b)
      .set('Authorization', 'Bearer org-a').set('X-Org-ID', b).set('X-Client-Platform', 'OWNER');
    expect(res.status).toBe(200);
    expect(userContextSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data.orgId).toBe(a);
  });
  it('concurrent requests keep separate org contexts', async () => {
    const { app } = setup();
    const [one, two] = await Promise.all([
      request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer org-a'),
      request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer org-b'),
    ]);
    expect(one.body.data.orgId).toBe(a); expect(two.body.data.orgId).toBe(b);
  });
  it('resolves active membership again on each request', async () => {
    const { app, resolveIdentity } = setup();
    await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer org-a');
    resolveIdentity.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Suspended'));
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer org-a');
    expect(res.status).toBe(403); expect(resolveIdentity).toHaveBeenCalledTimes(2);
  });
  it.each([['expired', 401], ['suspended', 403]])('returns stable error for %s', async (token, status) => {
    const res = await request(setup().app).get('/api/v1/auth/me').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(status); expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });
  it('never exposes internal exception messages', async () => {
    const res = await request(setup().app).get('/api/v1/auth/me').set('Authorization', 'Bearer failure');
    expect(res.status).toBe(500); expect(JSON.stringify(res.body)).not.toContain('password');
  });
  it('roles expose only their specified capabilities', () => {
    expect(permissionsFor('EMPLOYEE')).not.toContain('sales:void');
    expect(permissionsFor('EMPLOYEE')).not.toContain('reports:read');
    expect(permissionsFor('ACCOUNTANT')).toEqual(['reports:read', 'reports:export']);
    expect(permissionsFor('OWNER')).toContain('sales:void');
  });
});
describe('HTTP and contract protections', () => {
  it('allows authenticated HTTP without Origin', async () => {
    const res = await request(setup().app).get('/api/v1/auth/me').set('Authorization', 'Bearer org-a');
    expect(res.status).toBe(200);
  });
  it('allowed browser Origin still needs authentication', async () => {
    const res = await request(setup().app).get('/api/v1/auth/me').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(401); expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
  it('rejects an unlisted browser Origin', async () => {
    const res = await request(setup().app).get('/api/v1/auth/me').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });
  it('validates correlation IDs and redacts request/response logs', async () => {
    const { app, log } = setup();
    const res = await request(app).get('/api/v1/auth/me?secret=do-not-log')
      .set('Authorization', 'Bearer org-a').set('X-Request-ID', 'invalid');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(log.mock.calls)).not.toContain('do-not-log');
    expect(JSON.stringify(log.mock.calls)).not.toContain('Bearer');
  });
  it('preserves valid correlation IDs', async () => {
    const res = await request(setup().app).get('/api/v1/health').set('X-Request-ID', a);
    expect(res.headers['x-request-id']).toBe(a);
  });
  it('returns standard 404 and rejects malformed JSON', async () => {
    const app = setup().app;
    const missing = await request(app).get('/api/v1/missing');
    expect(missing.status).toBe(404); expect(errorResponseSchema.safeParse(missing.body).success).toBe(true);
    const malformed = await request(app).post('/api/v1/missing').set('Content-Type', 'application/json').send('{');
    expect(malformed.status).toBe(400); expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('retains canonical contract paths and money transport', () => {
    const contract = parse(readFileSync('contracts/openapi.yaml', 'utf8'));
    expect(contract.openapi).toBe('3.1.0');
    expect(contract.paths['/auth/me'].get.operationId).toBe('getCurrentUser');
    expect(contract.paths['/health'].get.security).toEqual([]);
    expect(contract.components.schemas.UserContext.required.sort()).toEqual(Object.keys(userContextSchema.shape).sort());
    expect(new RegExp(contract.components.schemas.Money.pattern).test('100.00')).toBe(true);
    expect(new RegExp(contract.components.schemas.Money.pattern).test('100')).toBe(false);
  });
});

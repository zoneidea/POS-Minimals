import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/api/src/app.js';
import { ApiError } from '../apps/api/src/infra/errors.js';
import { bootstrapResultSchema, errorResponseSchema } from '../packages/contracts/src/index.js';
const orgId = '00000000-0000-4000-8000-000000000001';
function setup() {
  const bootstrapOrganization = vi.fn(async () => ({ orgId, role: 'OWNER' as const, status: 'ACTIVE' as const }));
  const resolveIdentity = vi.fn();
  const app = createApp({ resolveIdentity, bootstrapOrganization, allowedOrigins: [], log: vi.fn() });
  return { app, bootstrapOrganization, resolveIdentity };
}
const body = { storeName: 'ร้าน A', displayUsername: 'เจ้าของ' };
describe('bootstrap HTTP boundary', () => {
  it('permits onboarding without requiring an existing membership', async () => {
    const { app, bootstrapOrganization, resolveIdentity } = setup();
    const res = await request(app).post('/api/v1/orgs/bootstrap').set('Authorization','Bearer verified').send(body);
    expect(res.status).toBe(200); expect(bootstrapResultSchema.safeParse(res.body.data).success).toBe(true);
    expect(bootstrapOrganization).toHaveBeenCalledWith('verified', body, res.headers['x-request-id']);
    expect(resolveIdentity).not.toHaveBeenCalled();
  });
  it('missing token cannot invoke provisioning', async () => {
    const { app, bootstrapOrganization } = setup();
    const res = await request(app).post('/api/v1/orgs/bootstrap').send(body);
    expect(res.status).toBe(401); expect(bootstrapOrganization).not.toHaveBeenCalled();
  });
  it.each([{...body,password:'secret'}, {...body,orgId}, {...body,role:'OWNER'}, {...body,storeName:''}, {...body,storeName:'a'.repeat(121)}, {...body,displayUsername:'a'.repeat(81)}])('rejects invalid/unexpected bootstrap fields', async (input) => {
    const { app, bootstrapOrganization } = setup();
    const res = await request(app).post('/api/v1/orgs/bootstrap').set('Authorization','Bearer verified').send(input);
    expect(res.status).toBe(400); expect(bootstrapOrganization).not.toHaveBeenCalled();
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });
  it('trims store and display names', async () => {
    const { app, bootstrapOrganization } = setup();
    await request(app).post('/api/v1/orgs/bootstrap').set('Authorization','Bearer verified').send({storeName:' ร้าน A ',displayUsername:' เจ้าของ '});
    expect(bootstrapOrganization).toHaveBeenCalledWith('verified',body,expect.any(String));
  });
  it.each([[403,'EMAIL_NOT_VERIFIED'],[409,'ORG_ALREADY_PROVISIONED'],[503,'SERVICE_UNAVAILABLE']])('preserves safe status/code %s %s', async (status, code) => {
    const { app, bootstrapOrganization } = setup();
    bootstrapOrganization.mockRejectedValueOnce(new ApiError(status as number,code as string,'ลองใหม่'));
    const res = await request(app).post('/api/v1/orgs/bootstrap').set('Authorization','Bearer verified').send(body);
    expect(res.status).toBe(status); expect(res.body.error.code).toBe(code);
  });
});

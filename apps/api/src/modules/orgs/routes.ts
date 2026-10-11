import { Router } from 'express';
import { bearerToken } from '../../middleware/bearer.js';
import { ApiError } from '../../infra/errors.js';
import { bootstrapRequestSchema, type BootstrapOrganization } from './schema.js';
export function organizationRoutes(bootstrap: BootstrapOrganization) {
  const router = Router();
  router.post('/bootstrap', async (req, res) => {
    const token = bearerToken(req.header('Authorization'));
    const input = bootstrapRequestSchema.safeParse(req.body);
    if (!input.success) throw new ApiError(400, 'VALIDATION_ERROR', 'ชื่อร้านและชื่อแสดงผลไม่ถูกต้อง');
    const data = await bootstrap(token, input.data, res.locals.requestId);
    res.json({ success: true, data });
  });
  return router;
}

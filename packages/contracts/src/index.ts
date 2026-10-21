import { z } from 'zod';

export const roleSchema = z.enum(['OWNER', 'EMPLOYEE', 'ACCOUNTANT']);
export const userContextSchema = z.object({
  userId: z.uuid(), orgId: z.uuid(), orgName: z.string(), username: z.string(),
  role: roleSchema, permissions: z.array(z.string()),
}).strict();
export type UserContext = z.infer<typeof userContextSchema>;
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.record(z.string(), z.unknown()).optional() }),
  requestId: z.uuid(),
});
export const moneySchema = z.string().regex(/^\d+\.\d{2}$/);
export type { paths, components } from './generated.js';

export const contactEmailSchema = z.string().trim().max(254).email();
export const contactPhoneSchema = z.string().trim().regex(/^0[0-9]{8,9}$/, 'กรุณากรอกเบอร์โทร 9–10 หลัก เริ่มต้นด้วย 0');

export const bootstrapRequestSchema = z.object({
  storeMode:z.enum(['RETAIL','CAFE']).optional(),
  storeName: z.string().trim().min(1).max(120),
  displayUsername: z.string().trim().min(1).max(80),
  phone: contactPhoneSchema,
}).strict();
export const bootstrapResultSchema = z.object({
  orgId: z.uuid(), role: z.literal('OWNER'), status: z.literal('ACTIVE'),reservePayStatus:z.enum(['PENDING','SENT','FAILED','UNKNOWN','NOT_CONFIGURED']).optional(),
}).strict();

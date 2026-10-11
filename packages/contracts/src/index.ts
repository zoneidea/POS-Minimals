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

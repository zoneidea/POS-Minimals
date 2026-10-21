import { z } from 'zod';
export const contactEmailSchema=z.string().trim().max(254).email();
export const bootstrapRequestSchema=z.object({storeMode:z.enum(['RETAIL','CAFE']).optional(),storeName:z.string().trim().min(1).max(120),displayUsername:z.string().trim().min(1).max(80),phone:z.string().trim().regex(/^0[0-9]{8,9}$/).max(10)}).strict();
export const bootstrapResultSchema = z.object({
  orgId: z.uuid(), role: z.literal('OWNER'), status: z.literal('ACTIVE'),reservePayStatus:z.enum(['PENDING','SENT','FAILED','UNKNOWN','NOT_CONFIGURED']).optional(),
}).strict();
export type BootstrapRequest = z.infer<typeof bootstrapRequestSchema>;
export type BootstrapResult = z.infer<typeof bootstrapResultSchema>;
export type BootstrapOrganization = (token: string, input: BootstrapRequest, requestId: string) => Promise<BootstrapResult>;

import { z } from 'zod';
export { bootstrapRequestSchema } from '@pos/contracts';
import { bootstrapRequestSchema } from '@pos/contracts';
export const bootstrapResultSchema = z.object({
  orgId: z.uuid(), role: z.literal('OWNER'), status: z.literal('ACTIVE'),
}).strict();
export type BootstrapRequest = z.infer<typeof bootstrapRequestSchema>;
export type BootstrapResult = z.infer<typeof bootstrapResultSchema>;
export type BootstrapOrganization = (token: string, input: BootstrapRequest, requestId: string) => Promise<BootstrapResult>;

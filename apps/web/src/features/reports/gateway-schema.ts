import {z} from 'zod';
const money=z.string().regex(/^\d+\.\d{2}$/);
export const gatewayReportResult=z.object({items:z.array(z.object({id:z.uuid(),saleNo:z.string(),paymentId:z.string(),completedAtUtc:z.string(),gross:money,fee:money,net:money,cashierName:z.string()})),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.literal(10),summary:z.object({gross:money,fees:money,net:money})});
export type GatewayReport=z.infer<typeof gatewayReportResult>;

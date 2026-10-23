import { z } from 'zod';
import { cashSaleInput } from './checkout-client';
export const pendingSaleSchema=z.object({key:z.uuid(),input:cashSaleInput});
export type PendingSale=z.infer<typeof pendingSaleSchema>;
export {pendingSaleKey} from './pending-sale-key';

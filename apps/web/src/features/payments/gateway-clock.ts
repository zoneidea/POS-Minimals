import {z} from 'zod';

export const gatewayConfirmation=z.object({status:z.string(),sale:z.unknown().optional(),expiresAt:z.iso.datetime().nullable().optional(),serverTime:z.iso.datetime().optional()});
/** Convert the verified server deadline to the local clock; never invent a TTL. */
export function gatewayLocalDeadline(result:z.infer<typeof gatewayConfirmation>,now=Date.now()){
 if(!result.expiresAt||!result.serverTime)return null;
 return now+Date.parse(result.expiresAt)-Date.parse(result.serverTime);
}

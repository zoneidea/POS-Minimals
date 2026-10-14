import { encryptStoreContact } from './contact-cipher.js';
import { contactEmailSchema } from './schema.js';
import { ApiError } from '../../infra/errors.js';
import { createUserClient, verifyUser } from '../../infra/supabase/user-client.js';
import { provisionOrganization } from './repository.js';
import type { BootstrapOrganization } from './schema.js';
export function createBootstrapService(url: string, key: string, encryptionKey: string): BootstrapOrganization {
  return async (token, input, requestId) => {
    const client = createUserClient(url, key, token);
    const user = await verifyUser(client, token);
    if (!user.email_confirmed_at) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'กรุณายืนยันอีเมลก่อนสร้างร้าน');
    if (!contactEmailSchema.safeParse(user.email).success) throw new ApiError(400, 'VALIDATION_ERROR', 'กรุณาระบุอีเมลบัญชีที่ถูกต้อง');
    return provisionOrganization(client, input, requestId, encryptStoreContact(input.phone, encryptionKey));
  };
}

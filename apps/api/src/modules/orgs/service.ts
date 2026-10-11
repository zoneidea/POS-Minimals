import { ApiError } from '../../infra/errors.js';
import { createUserClient, verifyUser } from '../../infra/supabase/user-client.js';
import { provisionOrganization } from './repository.js';
import type { BootstrapOrganization } from './schema.js';
export function createBootstrapService(url: string, key: string): BootstrapOrganization {
  return async (token, input, requestId) => {
    const client = createUserClient(url, key, token);
    const user = await verifyUser(client, token);
    if (!user.email_confirmed_at) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'กรุณายืนยันอีเมลก่อนสร้างร้าน');
    return provisionOrganization(client, input, requestId);
  };
}

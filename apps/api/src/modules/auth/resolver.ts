import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ApiError } from '../../infra/errors.js';
import { permissionsFor } from './permissions.js';
import type { ResolveIdentity } from './types.js';
const memberSchema = z.object({
  org_id: z.uuid(), user_id: z.uuid(), display_username: z.string(),
  role: z.enum(['OWNER', 'EMPLOYEE', 'ACCOUNTANT']),
});
const orgSchema = z.object({ name: z.string() });

export function createIdentityResolver(url: string, publishableKey: string): ResolveIdentity {
  return async (token) => {
    // Each request uses its own user JWT. No privileged client, role/session cache or shared token.
    const client = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: identity, error: authError } = await client.auth.getUser(token);
    if (authError) {
      if (authError.status && authError.status < 500) throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบอีกครั้ง');
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ไม่สามารถตรวจสอบการเข้าสู่ระบบได้');
    }
    if (!identity.user) throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');
    const { data: membership, error: memberError } = await client.from('organization_members')
      .select('org_id,user_id,display_username,role').eq('user_id', identity.user.id)
      .eq('status', 'ACTIVE').is('deleted_at', null).maybeSingle();
    if (memberError) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ไม่สามารถตรวจสอบสมาชิกได้');
    if (!membership) throw new ApiError(403, 'FORBIDDEN', 'ไม่พบสมาชิกที่ใช้งานอยู่');
    const member = memberSchema.parse(membership);
    const { data: organization, error: orgError } = await client.from('organizations')
      .select('name').eq('id', member.org_id).eq('status', 'ACTIVE').is('deleted_at', null).maybeSingle();
    if (orgError) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ไม่สามารถตรวจสอบร้านได้');
    if (!organization) throw new ApiError(403, 'FORBIDDEN', 'ร้านถูกระงับการใช้งาน');
    return { userId: identity.user.id, orgId: member.org_id, orgName: orgSchema.parse(organization).name,
      username: member.display_username, role: member.role, permissions: permissionsFor(member.role) };
  };
}

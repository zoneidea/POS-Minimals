import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../../infra/errors.js';
import { bootstrapResultSchema, type BootstrapRequest } from './schema.js';
export async function provisionOrganization(client: SupabaseClient, input: BootstrapRequest, requestId: string, privateCipher: string) {
  const { data, error } = await client.rpc('bootstrap_org_with_contact', {
    p_store_name: input.storeName, p_display_username: input.displayUsername, p_request_id: requestId, p_private_cipher: privateCipher,
  });
  if (error) {
    const known: Record<string, [number, string]> = {
      PT400: [400, 'VALIDATION_ERROR'], PT401: [401, 'UNAUTHENTICATED'],
      PT403: [403, error.message === 'EMAIL_NOT_VERIFIED' ? 'EMAIL_NOT_VERIFIED' : 'FORBIDDEN'],
      PT409: [409, 'ORG_ALREADY_PROVISIONED'],
    };
    const mapped = known[error.code];
    if (mapped) throw new ApiError(mapped[0], mapped[1], 'ไม่สามารถสร้างร้านได้ กรุณาตรวจสอบบัญชี');
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ไม่สามารถสร้างร้านได้ กรุณาลองใหม่');
  }
  const result = bootstrapResultSchema.safeParse(data);
  if (!result.success) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ข้อมูลร้านไม่สมบูรณ์');
  return result.data;
}

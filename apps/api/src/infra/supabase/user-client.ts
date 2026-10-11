import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../errors.js';
export function createUserClient(url: string, key: string, token: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export async function verifyUser(client: ReturnType<typeof createUserClient>, token: string) {
  const { data, error } = await client.auth.getUser(token);
  if (error) {
    if (error.status && error.status < 500) throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบอีกครั้ง');
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'ไม่สามารถตรวจสอบการเข้าสู่ระบบได้');
  }
  if (!data.user) throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');
  return data.user;
}

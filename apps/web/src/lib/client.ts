import { createClient } from '@supabase/supabase-js';
import { userContextSchema } from '../../../../packages/contracts/src/index';
// Capture only the error code before Auth consumes the redirect fragment; never retain tokens.
const callbackParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1));
export const confirmationError = callbackParams.get('error_code') ? 'ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ กรุณาขออีเมลยืนยันใหม่' : '';
export const auth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export class RequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function request(path: string, token: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(`/api/v1${path}`, { method: body ? 'POST' : 'GET', signal,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new RequestError(result.error?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้', response.status);
  return result.data;
}
export async function identity(token: string, signal?: AbortSignal) { return userContextSchema.parse(await request('/auth/me', token, undefined, signal)); }
export function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'invalid_credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (code === 'email_not_confirmed') return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
  return error instanceof RequestError ? error.message : 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือการเชื่อมต่อแล้วลองใหม่';
}

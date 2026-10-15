import { createClient } from '@supabase/supabase-js';
import { userContextSchema } from '../../../../packages/contracts/src/index';
// Capture only the error code before Auth consumes the redirect fragment; never retain tokens.
const callbackParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1));
export const confirmationError = callbackParams.get('error_code') ? 'ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ กรุณาขออีเมลยืนยันใหม่' : '';
export const authStorageKey=`sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
export const auth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:authStorageKey}});
export class RequestError extends Error { constructor(message: string, readonly status: number,readonly code?:string) { super(message); } }
export async function request(path: string, token: string, body?: unknown, signal?: AbortSignal, method?: 'GET'|'POST'|'PATCH'|'DELETE', idempotencyKey?: string) {
  const response = await fetch(`/api/v1${path}`, { method: method ?? (body ? 'POST' : 'GET'), signal,
    headers: { Authorization: `Bearer ${token}`, ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok){if(result.error?.code==='SESSION_DAY_EXPIRED'&&typeof window!=='undefined')window.dispatchEvent(new Event('pos:session-day-expired'));throw new RequestError(result.error?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้', response.status,result.error?.code);}
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

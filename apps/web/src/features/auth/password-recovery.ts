import { z } from 'zod';
import { auth } from '../../lib/client';
export const newPasswordSchema = z.object({ password: z.string().min(8, 'ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร'), confirm: z.string() }).refine(v => v.password === v.confirm, { message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', path: ['confirm'] });
export async function sendPasswordReset(email: string, origin: string) {
 const { error } = await auth.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL('/reset-password', origin).href });
 if (error) throw error;
}
export async function changeRecoveredPassword(input: { password: string; confirm: string }) {
 const values = newPasswordSchema.parse(input);
 const { error } = await auth.auth.updateUser({ password: values.password });
 if (error) throw error;
}

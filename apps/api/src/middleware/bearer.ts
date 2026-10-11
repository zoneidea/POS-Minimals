import { ApiError } from '../infra/errors.js';
export function bearerToken(authorization: string | undefined): string {
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match?.[1]) throw new ApiError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');
  return match[1];
}

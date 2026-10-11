import { auth, identity, RequestError } from './client';
export class SessionExpiredError extends Error {
 constructor() { super('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'); }
}
export async function identityWithRefresh(token: string, userId: string, signal?: AbortSignal) {
 try { return await identity(token, signal); }
 catch(error) { if (!(error instanceof RequestError) || error.status !== 401) throw error; }
 signal?.throwIfAborted();
 const { data, error } = await auth.auth.refreshSession();
 signal?.throwIfAborted();
 if (error) {
  // Connectivity failures are retryable; they must not be presented as revoked credentials.
  if (error.status === 0 || (error.status !== undefined && error.status >= 500) || error.name === 'AuthRetryableFetchError') throw error;
  throw new SessionExpiredError();
 }
 if (!data.session) throw new SessionExpiredError();
 if (data.session.user.id !== userId) throw new DOMException('Account changed', 'AbortError');
 try { return await identity(data.session.access_token, signal); }
 catch(error) { if (error instanceof RequestError && error.status === 401) throw new SessionExpiredError(); throw error; }
}

import { afterEach, expect, it, vi } from 'vitest';
import { createRequestKey } from '../apps/web/src/lib/request-key';

afterEach(() => vi.unstubAllGlobals());
it('creates a UUID request key without the secure-context randomUUID API', () => {
 vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0) });
 expect(createRequestKey()).toBe('00000000-0000-4000-8000-000000000000');
});
